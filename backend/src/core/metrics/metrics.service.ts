import { Injectable } from '@nestjs/common';
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly register: Registry;
  readonly httpRequestsTotal: Counter;
  readonly httpRequestDuration: Histogram;
  readonly httpErrorsTotal: Counter;

  constructor() {
    this.register = new Registry();
    collectDefaultMetrics({ register: this.register });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
      registers: [this.register],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
      registers: [this.register],
    });

    this.httpErrorsTotal = new Counter({
      name: 'http_errors_total',
      help: 'Total number of HTTP errors',
      labelNames: ['method', 'path', 'status'],
      registers: [this.register],
    });
  }

  recordRequest(method: string, path: string, status: number, durationMs: number): void {
    const pathNorm = path?.split('?')[0] || 'unknown';
    this.httpRequestsTotal.inc({ method, path: pathNorm, status: String(status) });
    this.httpRequestDuration.observe(
      { method, path: pathNorm },
      durationMs / 1000,
    );
    if (status >= 400) {
      this.httpErrorsTotal.inc({ method, path: pathNorm, status: String(status) });
    }
  }

  async getMetrics(): Promise<string> {
    return await this.register.metrics();
  }
}
