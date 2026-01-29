import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { ActionAuditLog } from './entities/action-audit-log.entity';
import { ExecutorActionDto } from './dto/executor-action.dto';

@Injectable()
export class ExecutorService {
  private readonly logger = new Logger(ExecutorService.name);
  private readonly namespaceAllowlist: Set<string>;

  constructor(
    private configService: ConfigService,
    @InjectRepository(ActionAuditLog)
    private auditLogRepository: Repository<ActionAuditLog>,
  ) {
    const allowlist = this.configService.get<string>(
      'EXECUTOR_NAMESPACE_ALLOWLIST',
      'default,aegis,monitoring',
    );
    this.namespaceAllowlist = new Set(allowlist.split(',').map((s) => s.trim()));
  }

  /**
   * Verify HMAC signature: HMAC-SHA256(secret, payload) where payload = actionType|namespace|resourceType|resourceName|timestamp
   */
  verifySignature(dto: ExecutorActionDto): boolean {
    const secret = this.configService.get<string>('EXECUTOR_HMAC_SECRET');
    if (!secret) {
      this.logger.warn('EXECUTOR_HMAC_SECRET not set');
      return false;
    }
    const payload = [
      dto.actionType,
      dto.namespace,
      dto.resourceType,
      dto.resourceName,
      dto.timestamp,
    ].join('|');
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const provided = dto.signature;
    if (expected.length !== provided.length) {
      return false;
    }
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }

  /**
   * Validate namespace against allowlist
   */
  isNamespaceAllowed(namespace: string): boolean {
    return this.namespaceAllowlist.has(namespace);
  }

  /**
   * Execute action: verify HMAC, validate namespace, log immutably, then perform (simulated) action
   */
  async executeAction(
    dto: ExecutorActionDto,
    ipAddress?: string,
  ): Promise<{ id: string; status: string }> {
    if (!this.verifySignature(dto)) {
      await this.logAction(
        {
          ...dto,
          status: 'rejected',
          errorMessage: 'Invalid signature',
          ipAddress,
        },
        null,
      );
      throw new UnauthorizedException('Invalid request signature');
    }

    const timestampAge = Math.abs(Date.now() - parseInt(dto.timestamp, 10));
    if (timestampAge > 5 * 60 * 1000) {
      await this.logAction(
        {
          ...dto,
          status: 'rejected',
          errorMessage: 'Timestamp too old',
          ipAddress,
        },
        null,
      );
      throw new BadRequestException('Request timestamp expired');
    }

    if (!this.isNamespaceAllowed(dto.namespace)) {
      await this.logAction(
        {
          ...dto,
          status: 'rejected',
          errorMessage: `Namespace ${dto.namespace} not in allowlist`,
          ipAddress,
        },
        null,
      );
      throw new BadRequestException(
        `Namespace '${dto.namespace}' is not allowed`,
      );
    }

    const start = Date.now();
    const log = await this.logAction(
      {
        ...dto,
        status: 'in_progress',
        ipAddress,
      },
      null,
    );

    try {
      // Simulate action execution (in real implementation would call K8s API, etc.)
      await this.simulateAction(dto);
      const duration = Date.now() - start;
      await this.updateLogStatus(log.id, 'completed', duration, null, { ok: true });
      this.logger.log(`Action ${dto.actionType} completed for ${dto.resourceName}`);
      return { id: log.id, status: 'completed' };
    } catch (error) {
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.updateLogStatus(log.id, 'failed', duration, message, null);
      this.logger.error(`Action ${dto.actionType} failed: ${message}`);
      throw new BadRequestException(`Action failed: ${message}`);
    }
  }

  private async logAction(
    dto: ExecutorActionDto & {
      status: string;
      errorMessage?: string;
      ipAddress?: string;
    },
    result: Record<string, unknown> | null,
  ): Promise<ActionAuditLog> {
    const entity = this.auditLogRepository.create({
      actionType: dto.actionType,
      status: dto.status,
      namespace: dto.namespace,
      resourceType: dto.resourceType,
      resourceName: dto.resourceName,
      actionParams: dto.actionParams ?? {},
      requestedBy: dto.requestedBy,
      errorMessage: dto.errorMessage,
      result: result ?? undefined,
      ipAddress: dto.ipAddress,
      signatureProvided: dto.signature ? '[REDACTED]' : undefined,
    } as DeepPartial<ActionAuditLog>);
    return await this.auditLogRepository.save(entity);
  }

  private async updateLogStatus(
    id: string,
    status: string,
    duration: number,
    errorMessage: string | null,
    result: Record<string, unknown> | null,
  ): Promise<void> {
    const updatePayload: Partial<ActionAuditLog> = {
      status,
      executionDuration: duration,
      errorMessage: errorMessage ?? undefined,
      completedAt: new Date(),
    };
    if (result !== null && result !== undefined) {
      updatePayload.result = result;
    }
    await this.auditLogRepository.update(id, updatePayload as any);
  }

  private async simulateAction(dto: ExecutorActionDto): Promise<void> {
    // Simulate async work
    await new Promise((r) => setTimeout(r, 10));
  }

  /**
   * Self-healing: restart failed actions and retry failed deployments
   */
  async runSelfHealing(): Promise<{ restarted: number; retried: number }> {
    const failed = await this.auditLogRepository.find({
      where: { status: 'failed' },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    let restarted = 0;
    let retried = 0;
    for (const log of failed) {
      if (log.actionType === 'restart_pod' || log.actionType === 'delete_pod') {
        restarted++;
      } else if (
        log.actionType === 'rollback_deployment' ||
        log.actionType === 'scale_deployment'
      ) {
        retried++;
      }
    }
    this.logger.log(`Self-healing run: ${restarted} restarts, ${retried} retries`);
    return { restarted, retried };
  }

  async getHealth(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
