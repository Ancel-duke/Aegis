/**
 * Backend Service - Prometheus Metrics & OpenTelemetry Instrumentation
 */

import { Injectable } from '@nestjs/common';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// =====================================================
// OpenTelemetry Setup
// =====================================================

export function initializeOpenTelemetry() {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'aegis-backend',
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/metrics',
      }),
      exportIntervalMillis: 10000,
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
    ],
  });

  sdk.start();
  
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('OpenTelemetry terminated'))
      .catch((error) => console.error('Error terminating OpenTelemetry', error))
      .finally(() => process.exit(0));
  });

  return sdk;
}

// =====================================================
// Prometheus Metrics
// =====================================================

@Injectable()
export class MetricsService {
  // Collect default metrics (CPU, memory, etc.)
  constructor() {
    collectDefaultMetrics({ prefix: 'aegis_backend_' });
  }

  // HTTP Request metrics
  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status', 'service'],
  });

  readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path', 'status', 'service'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  });

  // Authentication metrics
  readonly authAttemptsTotal = new Counter({
    name: 'auth_attempts_total',
    help: 'Total authentication attempts',
    labelNames: ['type', 'status'], // type: login, signup, refresh; status: success, failure
  });

  readonly activeSessionsGauge = new Gauge({
    name: 'active_sessions_total',
    help: 'Number of active user sessions',
  });

  // Policy Engine metrics
  readonly policyEvaluationsTotal = new Counter({
    name: 'policy_evaluations_total',
    help: 'Total policy evaluations',
    labelNames: ['action', 'result'], // result: allow, deny
  });

  readonly policyEvaluationDuration = new Histogram({
    name: 'policy_evaluation_duration_seconds',
    help: 'Policy evaluation duration in seconds',
    labelNames: ['action'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  });

  // Rate Limiting metrics
  readonly rateLimitExceeded = new Counter({
    name: 'rate_limit_exceeded_total',
    help: 'Total rate limit exceeded events',
    labelNames: ['endpoint', 'user_id'],
  });

  // Database metrics
  readonly dbQueryDuration = new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query duration in seconds',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  });

  readonly dbConnectionsActive = new Gauge({
    name: 'db_connections_active',
    help: 'Number of active database connections',
  });

  // Redis metrics
  readonly redisCacheHits = new Counter({
    name: 'redis_cache_hits_total',
    help: 'Total Redis cache hits',
    labelNames: ['key_pattern'],
  });

  readonly redisCacheMisses = new Counter({
    name: 'redis_cache_misses_total',
    help: 'Total Redis cache misses',
    labelNames: ['key_pattern'],
  });

  // User metrics
  readonly usersRegisteredTotal = new Counter({
    name: 'users_registered_total',
    help: 'Total number of registered users',
  });

  readonly activeUsersGauge = new Gauge({
    name: 'active_users_total',
    help: 'Number of active users',
  });

  /**
   * Get metrics for Prometheus scraping
   */
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }

  /**
   * Track HTTP request
   */
  trackHttpRequest(method: string, path: string, status: number, duration: number) {
    const service = 'backend';
    
    this.httpRequestsTotal.inc({ method, path, status: status.toString(), service });
    this.httpRequestDuration.observe({ method, path, status: status.toString(), service }, duration);
  }

  /**
   * Track authentication attempt
   */
  trackAuthAttempt(type: 'login' | 'signup' | 'refresh', success: boolean) {
    const status = success ? 'success' : 'failure';
    this.authAttemptsTotal.inc({ type, status });
  }

  /**
   * Update active sessions count
   */
  updateActiveSessions(count: number) {
    this.activeSessionsGauge.set(count);
  }

  /**
   * Track policy evaluation
   */
  trackPolicyEvaluation(action: string, result: 'allow' | 'deny', duration: number) {
    this.policyEvaluationsTotal.inc({ action, result });
    this.policyEvaluationDuration.observe({ action }, duration);
  }

  /**
   * Track rate limit exceeded
   */
  trackRateLimitExceeded(endpoint: string, userId: string) {
    this.rateLimitExceeded.inc({ endpoint, user_id: userId });
  }

  /**
   * Track database query
   */
  trackDbQuery(operation: string, table: string, duration: number) {
    this.dbQueryDuration.observe({ operation, table }, duration);
  }

  /**
   * Track Redis cache
   */
  trackCacheHit(keyPattern: string) {
    this.redisCacheHits.inc({ key_pattern: keyPattern });
  }

  trackCacheMiss(keyPattern: string) {
    this.redisCacheMisses.inc({ key_pattern: keyPattern });
  }
}

// =====================================================
// OpenTelemetry Tracing Helpers
// =====================================================

export class TracingService {
  private tracer = trace.getTracer('aegis-backend', '1.0.0');

  /**
   * Create a new span for a specific operation
   */
  startSpan(name: string, attributes?: Record<string, any>) {
    return this.tracer.startSpan(name, {
      attributes,
    });
  }

  /**
   * Trace an async function
   */
  async traceAsync<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, any>,
  ): Promise<T> {
    const span = this.startSpan(name, attributes);
    
    try {
      const result = await context.with(trace.setSpan(context.active(), span), fn);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Add attributes to current span
   */
  addAttributes(attributes: Record<string, any>) {
    const span = trace.getActiveSpan();
    if (span) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
  }

  /**
   * Add event to current span
   */
  addEvent(name: string, attributes?: Record<string, any>) {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }
}

// =====================================================
// Metrics Middleware
// =====================================================

export function createMetricsMiddleware(metricsService: MetricsService) {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      metricsService.trackHttpRequest(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration,
      );
    });
    
    next();
  };
}

// =====================================================
// Metrics Controller
// =====================================================

import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Public()
  async getMetrics(): Promise<string> {
    return await this.metricsService.getMetrics();
  }
}

// =====================================================
// Usage Example
// =====================================================

/*
// In main.ts
import { initializeOpenTelemetry } from './metrics/backend-metrics';

async function bootstrap() {
  // Initialize OpenTelemetry
  initializeOpenTelemetry();
  
  const app = await NestFactory.create(AppModule);
  
  // Add metrics middleware
  const metricsService = app.get(MetricsService);
  app.use(createMetricsMiddleware(metricsService));
  
  await app.listen(3000);
}

// In a service
import { MetricsService, TracingService } from './metrics/backend-metrics';

@Injectable()
export class AuthService {
  constructor(
    private metricsService: MetricsService,
    private tracingService: TracingService,
  ) {}

  async login(email: string, password: string) {
    return await this.tracingService.traceAsync(
      'auth.login',
      async () => {
        const start = Date.now();
        
        try {
          // Login logic...
          const user = await this.validateUser(email, password);
          
          this.metricsService.trackAuthAttempt('login', true);
          this.tracingService.addAttributes({
            'user.id': user.id,
            'user.email': email,
          });
          
          return user;
        } catch (error) {
          this.metricsService.trackAuthAttempt('login', false);
          throw error;
        } finally {
          const duration = (Date.now() - start) / 1000;
          this.metricsService.trackDbQuery('select', 'users', duration);
        }
      },
      {
        'auth.method': 'password',
        'auth.email': email,
      },
    );
  }
}
*/
