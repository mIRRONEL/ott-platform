import { Request, Response, NextFunction } from 'express';

interface HistogramEntry {
  labels: Record<string, string>;
  sum: number;
  count: number;
  buckets: Record<number, number>;
}

export class PrometheusRegistry {
  private serviceName: string;
  private startTime = Math.floor(Date.now() / 1000);
  private requestCounters: Map<string, { labels: Record<string, string>; value: number }> = new Map();
  private durationHistograms: Map<string, HistogramEntry> = new Map();
  private defaultBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  private getCounterKey(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
  }

  public recordRequest(method: string, route: string, statusCode: number, durationSec: number) {
    const cleanRoute = route
      .split('?')[0]
      .replace(/\/[0-9a-f]{24}/g, '/:id')
      .replace(/\/[0-9a-fA-F-]{36}/g, '/:uuid');
      
    const labels = {
      service: this.serviceName,
      method: method.toUpperCase(),
      route: cleanRoute,
      status_code: String(statusCode)
    };

    // 1. Total Requests Counter
    const counterKey = this.getCounterKey(labels);
    const existing = this.requestCounters.get(counterKey);
    if (existing) {
      existing.value += 1;
    } else {
      this.requestCounters.set(counterKey, { labels, value: 1 });
    }

    // 2. Duration Histogram
    const histLabels = { service: this.serviceName, method: method.toUpperCase(), route: cleanRoute };
    const histKey = this.getCounterKey(histLabels);
    let hist = this.durationHistograms.get(histKey);
    if (!hist) {
      const buckets: Record<number, number> = {};
      this.defaultBuckets.forEach((b) => (buckets[b] = 0));
      hist = { labels: histLabels, sum: 0, count: 0, buckets };
      this.durationHistograms.set(histKey, hist);
    }

    hist.sum += durationSec;
    hist.count += 1;
    for (const b of this.defaultBuckets) {
      if (durationSec <= b) {
        hist.buckets[b] = (hist.buckets[b] || 0) + 1;
      }
    }
  }

  public getMetrics(): string {
    const lines: string[] = [];
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();

    // Headers & Process Metrics
    lines.push(`# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.`);
    lines.push(`# TYPE process_cpu_seconds_total counter`);
    lines.push(`process_cpu_seconds_total{service="${this.serviceName}"} ${((cpu.user + cpu.system) / 1000000).toFixed(4)}`);

    lines.push(`# HELP nodejs_heap_size_used_bytes Process heap size used in bytes.`);
    lines.push(`# TYPE nodejs_heap_size_used_bytes gauge`);
    lines.push(`nodejs_heap_size_used_bytes{service="${this.serviceName}"} ${memory.heapUsed}`);

    lines.push(`# HELP nodejs_heap_size_total_bytes Process heap size total in bytes.`);
    lines.push(`# TYPE nodejs_heap_size_total_bytes gauge`);
    lines.push(`nodejs_heap_size_total_bytes{service="${this.serviceName}"} ${memory.heapTotal}`);

    lines.push(`# HELP nodejs_external_memory_bytes Nodejs external memory in bytes.`);
    lines.push(`# TYPE nodejs_external_memory_bytes gauge`);
    lines.push(`nodejs_external_memory_bytes{service="${this.serviceName}"} ${memory.external}`);

    lines.push(`# HELP process_resident_memory_bytes Resident memory size in bytes.`);
    lines.push(`# TYPE process_resident_memory_bytes gauge`);
    lines.push(`process_resident_memory_bytes{service="${this.serviceName}"} ${memory.rss}`);

    lines.push(`# HELP process_start_time_seconds Start time of the process since unix epoch in seconds.`);
    lines.push(`# TYPE process_start_time_seconds gauge`);
    lines.push(`process_start_time_seconds{service="${this.serviceName}"} ${this.startTime}`);

    lines.push(`# HELP process_uptime_seconds Total process uptime in seconds.`);
    lines.push(`# TYPE process_uptime_seconds gauge`);
    lines.push(`process_uptime_seconds{service="${this.serviceName}"} ${Math.floor(process.uptime())}`);

    // HTTP Requests Total
    lines.push(`# HELP http_requests_total Total number of HTTP requests.`);
    lines.push(`# TYPE http_requests_total counter`);
    for (const entry of this.requestCounters.values()) {
      const labelStr = Object.entries(entry.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      lines.push(`http_requests_total{${labelStr}} ${entry.value}`);
    }

    // HTTP Request Duration Histogram
    lines.push(`# HELP http_request_duration_seconds HTTP request duration in seconds.`);
    lines.push(`# TYPE http_request_duration_seconds histogram`);
    for (const hist of this.durationHistograms.values()) {
      const baseLabel = Object.entries(hist.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(',');
      for (const b of this.defaultBuckets) {
        lines.push(`http_request_duration_seconds_bucket{${baseLabel},le="${b}"} ${hist.buckets[b] || 0}`);
      }
      lines.push(`http_request_duration_seconds_bucket{${baseLabel},le="+Inf"} ${hist.count}`);
      lines.push(`http_request_duration_seconds_sum{${baseLabel}} ${hist.sum.toFixed(6)}`);
      lines.push(`http_request_duration_seconds_count{${baseLabel}} ${hist.count}`);
    }

    lines.push('');
    return lines.join('\n');
  }

  public getMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/metrics' || req.path === '/health' || req.path === '/favicon.ico') {
        return next();
      }
      const start = process.hrtime();
      res.on('finish', () => {
        const diff = process.hrtime(start);
        const durationSec = diff[0] + diff[1] / 1e9;
        this.recordRequest(req.method, req.route?.path || req.path, res.statusCode, durationSec);
      });
      next();
    };
  }
}

export const metricsRegistry = new PrometheusRegistry('api-gateway');
export const metricsMiddleware = metricsRegistry.getMiddleware();
