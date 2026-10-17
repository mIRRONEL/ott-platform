// ==============================================================================
// OTT Platform - High-Concurrency Load & Edge Benchmark Suite
// Tests Nginx Reverse Proxy, API Gateway, and HLS Video Edge Cache
// ==============================================================================

const http = require('http');

const ENDPOINTS = [
  {
    name: 'Nginx HLS Edge Segment Cache (1MB Video Chunk)',
    url: 'http://ott-nginx/api/stream/543a5a48-0bf5-405e-b0b1-e65690cc4a24/segment/playlist0?quality=1080p',
    concurrency: 50,
    totalRequests: 1000,
    headers: {}
  },
  {
    name: 'Full 24-Container Cluster Health Sweep (Authenticated Admin API)',
    url: 'http://ott-nginx/api/health/cluster',
    concurrency: 20,
    totalRequests: 200,
    headers: {
      'Authorization': 'Bearer ' + (process.env.ADMIN_TOKEN || '')
    }
  }
];

function runTest(endpoint) {
  return new Promise((resolve) => {
    console.log(`\n================================================================`);
    console.log(`🚀 Benchmarking: ${endpoint.name}`);
    console.log(`🎯 URL: ${endpoint.url}`);
    console.log(`⚡ Concurrency: ${endpoint.concurrency} workers | Total Requests: ${endpoint.totalRequests}`);
    console.log(`================================================================`);

    const latencies = [];
    const statusCounts = {};
    let cacheHits = 0;
    let cacheMisses = 0;
    let completed = 0;
    let totalBytes = 0;
    let activeWorkers = 0;
    let requestsLaunched = 0;
    const startTime = Date.now();

    function fireRequest() {
      if (requestsLaunched >= endpoint.totalRequests) return;
      requestsLaunched++;
      activeWorkers++;

      const reqStart = process.hrtime();
      const req = http.get(endpoint.url, { headers: endpoint.headers || {}, timeout: 10000 }, (res) => {
        let bodyLength = 0;
        const cacheHeader = res.headers['x-cache-status'];
        if (cacheHeader === 'HIT') cacheHits++;
        else if (cacheHeader === 'MISS') cacheMisses++;

        statusCounts[res.statusCode] = (statusCounts[res.statusCode] || 0) + 1;

        res.on('data', (chunk) => {
          bodyLength += chunk.length;
        });

        res.on('end', () => {
          const diff = process.hrtime(reqStart);
          const latencyMs = (diff[0] * 1e9 + diff[1]) / 1e6;
          latencies.push(latencyMs);
          totalBytes += bodyLength;
          completed++;
          activeWorkers--;

          if (completed >= endpoint.totalRequests) {
            finish();
          } else {
            fireRequest();
          }
        });
      });

      req.on('error', (err) => {
        statusCounts['ERROR'] = (statusCounts['ERROR'] || 0) + 1;
        completed++;
        activeWorkers--;
        if (completed >= endpoint.totalRequests) {
          finish();
        } else {
          fireRequest();
        }
      });
    }

    // Launch initial concurrency pool
    for (let i = 0; i < endpoint.concurrency; i++) {
      fireRequest();
    }

    function finish() {
      const totalTimeMs = Date.now() - startTime;
      const totalSeconds = totalTimeMs / 1000;
      const rps = (completed / totalSeconds).toFixed(2);

      latencies.sort((a, b) => a - b);
      const min = latencies[0]?.toFixed(2) || 0;
      const max = latencies[latencies.length - 1]?.toFixed(2) || 0;
      const sum = latencies.reduce((acc, v) => acc + v, 0);
      const mean = (sum / (latencies.length || 1)).toFixed(2);
      const p50 = latencies[Math.floor(latencies.length * 0.50)]?.toFixed(2) || 0;
      const p90 = latencies[Math.floor(latencies.length * 0.90)]?.toFixed(2) || 0;
      const p95 = latencies[Math.floor(latencies.length * 0.95)]?.toFixed(2) || 0;
      const p99 = latencies[Math.floor(latencies.length * 0.99)]?.toFixed(2) || 0;

      const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
      const throughputMbps = ((totalBytes * 8) / (totalSeconds * 1024 * 1024)).toFixed(2);

      console.log(`\n📊 Benchmark Results:`);
      console.log(`  ✓ Completed Requests : ${completed} in ${totalSeconds.toFixed(2)}s`);
      console.log(`  ⚡ Throughput (RPS)   : ${rps} req/sec`);
      console.log(`  📡 Data Transferred  : ${totalMb} MB (${throughputMbps} Mbps)`);
      if (cacheHits + cacheMisses > 0) {
        const hitRatio = ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1);
        console.log(`  🔥 Edge Cache Ratio  : ${hitRatio}% (${cacheHits} HITs, ${cacheMisses} MISSes)`);
      }
      console.log(`  📈 Status Codes      : ${JSON.stringify(statusCounts)}`);
      console.log(`\n⏱️ Latency Percentiles:`);
      console.log(`  • Min Latency        : ${min} ms`);
      console.log(`  • Mean Latency       : ${mean} ms`);
      console.log(`  • P50 (Median)       : ${p50} ms`);
      console.log(`  • P90                : ${p90} ms`);
      console.log(`  • P95                : ${p95} ms`);
      console.log(`  • P99                : ${p99} ms`);
      console.log(`  • Max Latency        : ${max} ms`);

      resolve();
    }
  });
}

async function runAll() {
  for (const ep of ENDPOINTS) {
    await runTest(ep);
  }
}

runAll();
