/**
 * Executor Service - Prometheus Metrics & OpenTelemetry Instrumentation
 */

import { Injectable } from '@nestjs/common';
import { register, Counter, Histogram, Gauge } from 'prom-client';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

@Injectable()
export class ExecutorMetricsService {
  // Action execution metrics
  readonly executorActionsTotal = new Counter({
    name: 'executor_actions_total',
    help: 'Total Kubernetes actions executed',
    labelNames: ['action_type', 'namespace', 'status'], // status: completed, failed, rejected
  });

  readonly executorActionDuration = new Histogram({
    name: 'executor_action_duration_seconds',
    help: 'Action execution duration in seconds',
    labelNames: ['action_type', 'namespace'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  });

  readonly executorPendingActions = new Gauge({
    name: 'executor_pending_actions',
    help: 'Number of pending actions',
  });

  // Resource-specific metrics
  readonly executorPodRestarts = new Counter({
    name: 'executor_pod_restarts_total',
    help: 'Total pod restarts executed',
    labelNames: ['namespace'],
  });

  readonly executorScalingOperations = new Counter({
    name: 'executor_scaling_operations_total',
    help: 'Total scaling operations',
    labelNames: ['namespace', 'direction'], // direction: up, down
  });

  readonly executorRollbacks = new Counter({
    name: 'executor_rollbacks_total',
    help: 'Total rollback operations',
    labelNames: ['namespace'],
  });

  // Policy integration metrics
  readonly executorPolicyChecks = new Counter({
    name: 'executor_policy_checks_total',
    help: 'Total policy checks before execution',
    labelNames: ['result'], // result: approved, denied
  });

  readonly executorPolicyCheckDuration = new Histogram({
    name: 'executor_policy_check_duration_seconds',
    help: 'Policy check duration',
    buckets: [0.01, 0.05, 0.1, 0.5, 1],
  });

  // Audit metrics
  readonly executorAuditLogsCreated = new Counter({
    name: 'executor_audit_logs_created_total',
    help: 'Total audit logs created',
  });

  readonly executorAuditLogSize = new Histogram({
    name: 'executor_audit_log_size_bytes',
    help: 'Audit log entry size in bytes',
    buckets: [100, 500, 1000, 5000, 10000],
  });

  // Rate limiting metrics
  readonly executorRateLimitHits = new Counter({
    name: 'executor_rate_limit_hits_total',
    help: 'Total rate limit hits',
    labelNames: ['action_type', 'namespace'],
  });

  // Kubernetes API metrics
  readonly executorK8sApiCalls = new Counter({
    name: 'executor_k8s_api_calls_total',
    help: 'Total Kubernetes API calls',
    labelNames: ['operation', 'resource_type', 'status'],
  });

  readonly executorK8sApiDuration = new Histogram({
    name: 'executor_k8s_api_duration_seconds',
    help: 'Kubernetes API call duration',
    labelNames: ['operation', 'resource_type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  });

  // Error tracking
  readonly executorErrors = new Counter({
    name: 'executor_errors_total',
    help: 'Total executor errors',
    labelNames: ['error_type', 'action_type'], // error_type: validation, authorization, k8s_api, timeout
  });

  /**
   * Get metrics for Prometheus scraping
   */
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }

  /**
   * Track action execution
   */
  trackAction(
    actionType: string,
    namespace: string,
    status: 'completed' | 'failed' | 'rejected',
    duration: number,
  ) {
    this.executorActionsTotal.inc({ action_type: actionType, namespace, status });
    this.executorActionDuration.observe({ action_type: actionType, namespace }, duration);

    // Track specific action types
    if (actionType === 'restart_pod' && status === 'completed') {
      this.executorPodRestarts.inc({ namespace });
    } else if (actionType === 'scale_deployment' && status === 'completed') {
      // Determine direction from context if available
      this.executorScalingOperations.inc({ namespace, direction: 'up' });
    } else if (actionType === 'rollback_deployment' && status === 'completed') {
      this.executorRollbacks.inc({ namespace });
    }
  }

  /**
   * Track policy check
   */
  trackPolicyCheck(approved: boolean, duration: number) {
    const result = approved ? 'approved' : 'denied';
    this.executorPolicyChecks.inc({ result });
    this.executorPolicyCheckDuration.observe(duration);
  }

  /**
   * Track audit log creation
   */
  trackAuditLog(sizeBytes: number) {
    this.executorAuditLogsCreated.inc();
    this.executorAuditLogSize.observe(sizeBytes);
  }

  /**
   * Track rate limit hit
   */
  trackRateLimitHit(actionType: string, namespace: string) {
    this.executorRateLimitHits.inc({ action_type: actionType, namespace });
  }

  /**
   * Track Kubernetes API call
   */
  trackK8sApiCall(
    operation: string,
    resourceType: string,
    status: 'success' | 'error',
    duration: number,
  ) {
    this.executorK8sApiCalls.inc({ operation, resource_type: resourceType, status });
    this.executorK8sApiDuration.observe({ operation, resource_type: resourceType }, duration);
  }

  /**
   * Track error
   */
  trackError(errorType: string, actionType: string) {
    this.executorErrors.inc({ error_type: errorType, action_type: actionType });
  }

  /**
   * Update pending actions count
   */
  updatePendingActions(count: number) {
    this.executorPendingActions.set(count);
  }
}

// =====================================================
// OpenTelemetry Tracing for Executor
// =====================================================

@Injectable()
export class ExecutorTracingService {
  private tracer = trace.getTracer('aegis-executor', '1.0.0');

  /**
   * Trace action execution
   */
  async traceActionExecution<T>(
    actionType: string,
    namespace: string,
    resourceName: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const span = this.tracer.startSpan('executor.execute_action', {
      attributes: {
        'action.type': actionType,
        'k8s.namespace': namespace,
        'k8s.resource': resourceName,
      },
    });

    try {
      const result = await context.with(trace.setSpan(context.active(), span), fn);
      span.setStatus({ code: SpanStatusCode.OK });
      span.setAttribute('action.status', 'completed');
      return result;
    } catch (error) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.setAttribute('action.status', 'failed');
      span.setAttribute('error.type', error.constructor.name);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Trace policy check
   */
  async tracePolicyCheck<T>(
    action: string,
    resource: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const span = this.tracer.startSpan('executor.check_policy', {
      attributes: {
        'policy.action': action,
        'policy.resource': resource,
      },
    });

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
   * Trace Kubernetes API call
   */
  async traceK8sApiCall<T>(
    operation: string,
    resourceType: string,
    namespace: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const span = this.tracer.startSpan('executor.k8s_api_call', {
      attributes: {
        'k8s.operation': operation,
        'k8s.resource_type': resourceType,
        'k8s.namespace': namespace,
      },
    });

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
}

// =====================================================
// Metrics Controller
// =====================================================

import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller('metrics')
export class ExecutorMetricsController {
  constructor(private readonly metricsService: ExecutorMetricsService) {}

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
import { ExecutorMetricsService, ExecutorTracingService } from './metrics/executor-metrics';

@Injectable()
export class ExecutorService {
  constructor(
    private metricsService: ExecutorMetricsService,
    private tracingService: ExecutorTracingService,
    private k8sService: KubernetesService,
  ) {}

  async executeAction(dto: ExecuteActionDto) {
    const startTime = Date.now();

    return await this.tracingService.traceActionExecution(
      dto.actionType,
      dto.actionParams.namespace,
      dto.actionParams.resourceName,
      async () => {
        try {
          // Check policy
          const policyStart = Date.now();
          const policyDecision = await this.checkPolicy(dto);
          const policyDuration = (Date.now() - policyStart) / 1000;
          
          this.metricsService.trackPolicyCheck(
            policyDecision.allowed,
            policyDuration
          );

          if (!policyDecision.allowed) {
            const duration = (Date.now() - startTime) / 1000;
            this.metricsService.trackAction(
              dto.actionType,
              dto.actionParams.namespace,
              'rejected',
              duration
            );
            throw new ForbiddenException('Policy denied');
          }

          // Execute action
          const result = await this.performAction(dto);

          // Track success
          const duration = (Date.now() - startTime) / 1000;
          this.metricsService.trackAction(
            dto.actionType,
            dto.actionParams.namespace,
            'completed',
            duration
          );

          return result;
        } catch (error) {
          // Track failure
          const duration = (Date.now() - startTime) / 1000;
          this.metricsService.trackAction(
            dto.actionType,
            dto.actionParams.namespace,
            'failed',
            duration
          );
          
          this.metricsService.trackError(
            error.name,
            dto.actionType
          );

          throw error;
        }
      }
    );
  }
}
*/
