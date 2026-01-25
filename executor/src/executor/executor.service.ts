import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KubernetesService } from '../kubernetes/kubernetes.service';
import { AuditService } from '../audit/audit.service';
import { ActionType, ActionStatus } from '../audit/entities/action-audit-log.entity';
import { ExecuteActionDto } from './dto/execute-action.dto';
import * as crypto from 'crypto';

@Injectable()
export class ExecutorService {
  private readonly logger = new Logger(ExecutorService.name);
  private readonly allowedNamespaces: string[];

  constructor(
    private k8sService: KubernetesService,
    private auditService: AuditService,
    private configService: ConfigService,
  ) {
    const namespaces = this.configService.get<string>('ALLOWED_NAMESPACES', 'default');
    this.allowedNamespaces = namespaces.split(',').map((ns) => ns.trim());
  }

  /**
   * Execute an action with full validation and audit logging
   */
  async executeAction(
    dto: ExecuteActionDto,
    ipAddress?: string,
  ): Promise<{ success: boolean; auditId: string; result?: any; error?: string }> {
    const startTime = Date.now();

    // Validate namespace
    this.validateNamespace(dto.actionParams['namespace']);

    // Validate action signature if required
    if (this.configService.get<boolean>('REQUIRE_ACTION_SIGNATURE', true)) {
      this.validateSignature(dto);
    }

    // Create audit log
    const auditLog = await this.auditService.createAuditLog({
      actionType: dto.actionType,
      namespace: dto.actionParams['namespace'],
      resourceType: this.getResourceType(dto.actionType),
      resourceName: this.getResourceName(dto.actionParams),
      actionParams: dto.actionParams,
      requestedBy: dto.requestedBy,
      policyDecision: dto.policyDecision as any,
      signature: dto.signature,
      ipAddress,
      status: ActionStatus.PENDING,
    });

    try {
      // Update status to in progress
      await this.auditService.updateAuditLog(auditLog.id, {
        status: ActionStatus.IN_PROGRESS,
      });

      // Execute the action
      const result = await this.performAction(dto);

      // Mark as completed
      const duration = Date.now() - startTime;
      await this.auditService.markCompleted(auditLog.id, result, duration);

      this.logger.log(
        `Action ${dto.actionType} completed successfully in ${duration}ms`,
      );

      return {
        success: true,
        auditId: auditLog.id,
        result,
      };
    } catch (error) {
      // Mark as failed
      const duration = Date.now() - startTime;
      await this.auditService.markFailed(auditLog.id, error.message, duration);

      this.logger.error(
        `Action ${dto.actionType} failed: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        auditId: auditLog.id,
        error: error.message,
      };
    }
  }

  /**
   * Perform the actual Kubernetes action
   */
  private async performAction(dto: ExecuteActionDto): Promise<any> {
    switch (dto.actionType) {
      case ActionType.RESTART_POD:
        return await this.restartPod(dto.actionParams as any);

      case ActionType.SCALE_DEPLOYMENT:
        return await this.scaleDeployment(dto.actionParams as any);

      case ActionType.ROLLBACK_DEPLOYMENT:
        return await this.rollbackDeployment(dto.actionParams as any);

      default:
        throw new BadRequestException(`Unsupported action type: ${dto.actionType}`);
    }
  }

  /**
   * Restart a pod
   */
  private async restartPod(params: {
    namespace: string;
    podName: string;
  }): Promise<any> {
    const { namespace, podName } = params;

    // Check if pod exists
    const exists = await this.k8sService.resourceExists(
      namespace,
      'pod',
      podName,
    );

    if (!exists) {
      throw new BadRequestException(`Pod ${podName} not found in namespace ${namespace}`);
    }

    // Restart pod
    const result = await this.k8sService.restartPod(namespace, podName);

    return {
      action: 'restart_pod',
      namespace,
      podName,
      status: 'deleted',
      message: 'Pod deleted and will be recreated by deployment',
    };
  }

  /**
   * Scale a deployment
   */
  private async scaleDeployment(params: {
    namespace: string;
    deploymentName: string;
    replicas: number;
  }): Promise<any> {
    const { namespace, deploymentName, replicas } = params;

    // Check if deployment exists
    const exists = await this.k8sService.resourceExists(
      namespace,
      'deployment',
      deploymentName,
    );

    if (!exists) {
      throw new BadRequestException(
        `Deployment ${deploymentName} not found in namespace ${namespace}`,
      );
    }

    // Get current replica count
    const deployment = await this.k8sService.getDeploymentStatus(
      namespace,
      deploymentName,
    );
    const currentReplicas = deployment.spec?.replicas || 0;

    // Scale deployment
    const result = await this.k8sService.scaleDeployment(
      namespace,
      deploymentName,
      replicas,
    );

    return {
      action: 'scale_deployment',
      namespace,
      deploymentName,
      previousReplicas: currentReplicas,
      newReplicas: replicas,
      status: 'scaled',
    };
  }

  /**
   * Rollback a deployment
   */
  private async rollbackDeployment(params: {
    namespace: string;
    deploymentName: string;
    revision?: number;
  }): Promise<any> {
    const { namespace, deploymentName, revision } = params;

    // Check if deployment exists
    const exists = await this.k8sService.resourceExists(
      namespace,
      'deployment',
      deploymentName,
    );

    if (!exists) {
      throw new BadRequestException(
        `Deployment ${deploymentName} not found in namespace ${namespace}`,
      );
    }

    // Rollback deployment
    const result = await this.k8sService.rollbackDeployment(
      namespace,
      deploymentName,
      revision,
    );

    return {
      action: 'rollback_deployment',
      namespace,
      deploymentName,
      revision: revision || 'previous',
      status: 'rolled_back',
    };
  }

  /**
   * Validate namespace is allowed
   */
  private validateNamespace(namespace: string): void {
    if (!this.allowedNamespaces.includes(namespace)) {
      throw new ForbiddenException(
        `Namespace ${namespace} is not in allowed list: ${this.allowedNamespaces.join(', ')}`,
      );
    }
  }

  /**
   * Validate action signature
   */
  private validateSignature(dto: ExecuteActionDto): void {
    if (!dto.signature) {
      throw new BadRequestException('Action signature is required');
    }

    // Generate expected signature
    const payload = JSON.stringify({
      actionType: dto.actionType,
      actionParams: dto.actionParams,
      requestedBy: dto.requestedBy,
    });

    const secret = this.configService.get<string>('JWT_SECRET');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (dto.signature !== expectedSignature) {
      throw new ForbiddenException('Invalid action signature');
    }
  }

  /**
   * Get resource type from action type
   */
  private getResourceType(actionType: ActionType): string {
    switch (actionType) {
      case ActionType.RESTART_POD:
      case ActionType.DELETE_POD:
        return 'pod';
      case ActionType.SCALE_DEPLOYMENT:
      case ActionType.ROLLBACK_DEPLOYMENT:
        return 'deployment';
      default:
        return 'unknown';
    }
  }

  /**
   * Get resource name from action params
   */
  private getResourceName(params: any): string {
    return params.podName || params.deploymentName || 'unknown';
  }

  /**
   * Generate action signature (helper for clients)
   */
  generateSignature(
    actionType: ActionType,
    actionParams: any,
    requestedBy: string,
  ): string {
    const payload = JSON.stringify({
      actionType,
      actionParams,
      requestedBy,
    });

    const secret = this.configService.get<string>('JWT_SECRET');
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }
}
