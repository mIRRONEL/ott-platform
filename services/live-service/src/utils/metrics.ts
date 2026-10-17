import { Request, Response, NextFunction } from 'express';

class SimpleMetricsRegistry {
  private requestCounts: Map<string, number> = new Map();
  private requestDurations: Map<string, number[]> = new Map();
  private startTime: number = Date.now();

  incrementRequests(method: string, path: string, status: number): void {
    const key = `${method}:${path}:${status}`;
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);
  }

  recordDuration(method: string, path: string, status: number, durationSeconds: number): void {
    const key = `${method}:${path}:${status}`;
    if (!this.requestDurations.has(key)) {
      this.requestDurations.set(key, []);
    }
    const list = this.requestDurations.get(key)!;
    list.push(durationSeconds);
    if (list.length > 200) list.shift();
  }

  getMetrics(): string {
    const lines: string[] = [
      '# HELP http_requests_total Total number of HTTP requests made.',
      '# TYPE http_requests_total counter'
    ];

    for (const [key, count] of this.requestCounts.entries()) {
      const [method, path, status] = key.split(':');
      lines.push(`http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`);
    }

    const mem = process.memoryUsage();
    lines.push(
      '# HELP process_resident_memory_bytes Resident memory size in bytes.',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${mem.rss}`,
      '# HELP nodejs_heap_used_bytes Node.js heap memory used in bytes.',
      '# TYPE nodejs_heap_used_bytes gauge',
      `nodejs_heap_used_bytes ${mem.heapUsed}`,
      '# HELP nodejs_process_uptime_seconds Process uptime in seconds.',
      '# TYPE nodejs_process_uptime_seconds gauge',
      `nodejs_process_uptime_seconds ${((Date.now() - this.startTime) / 1000).toFixed(2)}`
    );

    return lines.join('\n') + '\n';
  }
}

export const metricsRegistry = new SimpleMetricsRegistry();

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const cleanPath = req.route?.path || req.path;
    metricsRegistry.incrementRequests(req.method, cleanPath, res.statusCode);
    metricsRegistry.recordDuration(req.method, cleanPath, res.statusCode, duration);
  });
  next();
};
