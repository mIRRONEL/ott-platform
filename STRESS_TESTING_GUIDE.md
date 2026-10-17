# ⚡ OTT Platform - Comprehensive Stress Testing & Load Benchmarking Guide

This guide provides practical tools, copy-paste commands, and real-time observability methods to stress test and benchmark the OTT platform.

---

## 📋 Table of Contents
1. [Prerequisites & Target Architecture](#1-prerequisites--target-architecture)
2. [Method 1: Built-in Custom Node.js Benchmark Suite](#method-1-built-in-custom-nodejs-benchmark-suite)
3. [Method 2: Industrial Load Testing with k6 (Dockerized)](#method-2-industrial-load-testing-with-k6-dockerized)
4. [Method 3: High-Throughput HTTP Benchmarking with Autocannon](#method-3-high-throughput-http-benchmarking-with-autocannon)
5. [Method 4: Quick CLI Stress with Apache Benchmark (ab) & curl](#method-4-quick-cli-stress-with-apache-benchmark-ab--curl)
6. [Key Test Endpoints & Scenarios](#key-test-endpoints--scenarios)
7. [Real-Time Monitoring During Tests](#real-time-monitoring-during-tests)

---

## 1. Prerequisites & Target Architecture

All tests hit the unified **Nginx Edge Reverse Proxy** on standard **Port 80**:

* **Host IP**: `180.94.20.40`
* **Base HTTP URL**: `http://180.94.20.40` (or `http://localhost:80` when testing locally on the server)
* **Grafana Live Metrics**: `http://180.94.20.40/grafana/` (Credentials: `admin` / `admin`)
* **Admin Login API**: `POST /api/auth/login` (`admin@example.com` / `admin123`)

---

## Method 1: Built-in Custom Node.js Benchmark Suite

A pre-configured, high-performance benchmarking tool is included in your repository at [`scripts/benchmark.js`](./scripts/benchmark.js).

### How to Run:
Run it directly inside the API Gateway container:

```bash
# 1. Fetch admin authentication token
ADMIN_TOKEN=$(curl -s -X POST http://localhost:80/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' | jq -r '.data.access_token')

# 2. Copy script to container & run with 50-100 concurrent workers
docker cp /home/almalinux/ott-app/scripts/benchmark.js ott-app-api-gateway-1:/tmp/benchmark.js
docker exec -e ADMIN_TOKEN="$ADMIN_TOKEN" ott-app-api-gateway-1 node /tmp/benchmark.js
```

### Customizing Load Parameters:
Edit [`scripts/benchmark.js`](./scripts/benchmark.js) to adjust concurrency and request counts:
```javascript
{
  name: 'Nginx HLS Edge Segment Cache (1MB Video Chunk)',
  url: 'http://ott-nginx/api/stream/543a5a48-0bf5-405e-b0b1-e65690cc4a24/segment/playlist0?quality=1080p',
  concurrency: 100,      // Number of concurrent client workers
  totalRequests: 5000,   // Total requests to complete
}
```

---

## Method 2: Industrial Load Testing with k6 (Dockerized)

**k6** is an enterprise open-source load testing tool developed by Grafana Labs. You can run it instantly using Docker without installing any host dependencies.

### Step 1: Create a k6 Test Script (`load-test.js`)
Create a file named `k6-stress.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 20 },  // Ramp-up to 20 users
    { duration: '30s', target: 100 }, // Peak stress at 100 concurrent users
    { duration: '10s', target: 0 },   // Ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests must complete below 300ms
    http_req_failed: ['rate<0.01'],   // Error rate must be under 1%
  },
};

export default function () {
  // Test 1: HLS Video Segment Edge Cache
  const segRes = http.get('http://ott-nginx/api/stream/543a5a48-0bf5-405e-b0b1-e65690cc4a24/segment/playlist0?quality=1080p');
  check(segRes, {
    'Segment status 200': (r) => r.status === 200,
    'Cache HIT': (r) => r.headers['X-Cache-Status'] === 'HIT',
  });

  // Test 2: Elasticsearch Video Search
  const searchRes = http.get('http://ott-nginx/api/content/search?q=cinema');
  check(searchRes, {
    'Search status 200': (r) => r.status === 200,
  });

  sleep(0.1);
}
```

### Step 2: Run k6 inside the Docker network
```bash
docker run --rm -i \
  --network ott-app_ott-network \
  -v $(pwd)/k6-stress.js:/k6-stress.js \
  grafana/k6 run /k6-stress.js
```

---

## Method 3: High-Throughput HTTP Benchmarking with Autocannon

Run **Autocannon** directly inside a Node container for raw HTTP connection saturation:

```bash
# 1. Stress test Nginx HLS Edge Segment Cache (100 concurrent connections for 15 seconds)
docker run --rm --network ott-app_ott-network node:20-alpine \
  npx autocannon -c 100 -d 15 \
  http://ott-nginx/api/stream/543a5a48-0bf5-405e-b0b1-e65690cc4a24/segment/playlist0?quality=1080p

# 2. Stress test Elasticsearch Video Search API (50 connections for 15 seconds)
docker run --rm --network ott-app_ott-network node:20-alpine \
  npx autocannon -c 50 -d 15 \
  http://ott-nginx/api/content/search?q=cinema

# 3. Stress test Dynamic Cluster Discovery (requires Auth Header)
ADMIN_TOKEN=$(curl -s -X POST http://localhost:80/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' | jq -r '.data.access_token')

docker run --rm --network ott-app_ott-network node:20-alpine \
  npx autocannon -c 30 -d 15 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://ott-nginx/api/health/cluster
```

---

## Method 4: Quick CLI Stress with Apache Benchmark (ab) & curl

### Using Dockerized Apache Benchmark:
```bash
# Send 2,000 requests with 50 concurrent connections to Nginx Edge Cache
docker run --rm --network ott-app_ott-network httpd:alpine \
  ab -n 2000 -c 50 \
  http://ott-nginx/api/stream/543a5a48-0bf5-405e-b0b1-e65690cc4a24/segment/playlist0?quality=1080p
```

### Multi-Threaded Background `curl` Loop:
```bash
# Spawn 20 parallel background loops requesting video chunks
for i in {1..20}; do
  (
    for j in {1..50}; do
      curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" \
        http://localhost:80/api/stream/543a5a48-0bf5-405e-b0b1-e65690cc4a24/segment/playlist0?quality=1080p
    done
  ) &
done
wait
echo "Load test complete!"
```

---

## 🎯 Key Test Endpoints & Scenarios

| Scenario | Target Endpoint | What It Stresses | Expected Metric |
| :--- | :--- | :--- | :--- |
| **HLS Video Delivery** | `GET /api/stream/:id/segment/playlist0?quality=1080p` | Nginx Edge Cache & RAM/Disk I/O | `X-Cache-Status: HIT`, Latency < 10ms, > 3 Gbps |
| **Catalog Search** | `GET /api/content/search?q=cinema` | Elasticsearch 8 Full-Text Engine | Latency < 30ms, Status 200 |
| **Master HLS Playlist** | `GET /api/stream/:id/manifest` | Content Service & Dynamic Manifest Gen | Latency < 15ms, `#EXTM3U` |
| **Live TV Channels** | `GET /api/stream/live/cinema/master.m3u8` | Live Streaming Engine | Latency < 10ms |
| **Cluster Health Probe** | `GET /api/health/cluster` | API Gateway Socket Sweeper (24 containers) | All 24 status `UP` |

---

## 📊 Real-Time Monitoring During Tests

Open multiple terminal windows or browser tabs while running the stress test:

### 1. Live Container CPU & Memory (Terminal)
Run this command in a separate terminal to watch CPU and RAM usage of all 24 containers live:
```bash
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
```

### 2. Live Nginx Edge Cache Hit Ratio (Terminal)
Tail the Nginx access log to inspect `cache=HIT` vs `cache=MISS` and response times:
```bash
docker logs -f ott-nginx | grep -E "cache=(HIT|MISS)"
```

### 3. Grafana Live Dashboards (Browser)
Visit: **`http://180.94.20.40/grafana/`** (Login: `admin` / `admin`)
* **Dashboard: Containers & Host Resources (cAdvisor / Node Exporter)**:
  * Watch Host CPU utilization spikes.
  * Watch Per-Container CPU % (observe Nginx, API Gateway, Elasticsearch).
  * Watch Network I/O throughput in MB/s.
* **Dashboard: Cluster Observability**:
  * Watch Prometheus request rate counters (`http_requests_total`).
