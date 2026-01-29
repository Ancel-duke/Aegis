import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  ActionAuditLog,
  ActionStatus,
  ActionType,
} from './entities/action-audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(ActionAuditLog)
    private auditLogRepository: Repository<ActionAuditLog>,
    private configService: ConfigService,
  ) {}

  /**
   * Create audit log entry for action execution
   */
  async createAuditLog(data: Partial<ActionAuditLog>): Promise<ActionAuditLog> {
    const log = this.auditLogRepository.create({
      status: ActionStatus.PENDING,
      ...data,
    });

    const saved = await this.auditLogRepository.save(log);
    this.logger.log(`Audit log created: ${saved.id} - ${saved.actionType}`);

    // Send to Loki if configured
    await this.sendToLoki(saved);

    return saved;
  }

  /**
   * Update audit log status
   */
  async updateAuditLog(
    id: string,
    updates: Partial<ActionAuditLog>,
  ): Promise<ActionAuditLog> {
    await this.auditLogRepository.update(id, updates);
    const updated = await this.auditLogRepository.findOne({ where: { id } });

    if (!updated) {
      throw new NotFoundException(`Audit log not found after update: ${id}`);
    }
    this.logger.log(`Audit log updated: ${id} - status: ${updated.status}`);
    await this.sendToLoki(updated);
    return updated;
  }

  /**
   * Mark action as completed
   */
  async markCompleted(
    id: string,
    result: Record<string, any>,
    duration: number,
  ): Promise<void> {
    await this.updateAuditLog(id, {
      status: ActionStatus.COMPLETED,
      result,
      executionDuration: duration,
      completedAt: new Date(),
    });
  }

  /**
   * Mark action as failed
   */
  async markFailed(
    id: string,
    errorMessage: string,
    duration: number,
  ): Promise<void> {
    await this.updateAuditLog(id, {
      status: ActionStatus.FAILED,
      errorMessage,
      executionDuration: duration,
      completedAt: new Date(),
    });
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(filters?: {
    actionType?: ActionType;
    status?: ActionStatus;
    namespace?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<ActionAuditLog[]> {
    const query = this.auditLogRepository.createQueryBuilder('log');

    if (filters?.actionType) {
      query.andWhere('log.actionType = :actionType', {
        actionType: filters.actionType,
      });
    }

    if (filters?.status) {
      query.andWhere('log.status = :status', { status: filters.status });
    }

    if (filters?.namespace) {
      query.andWhere('log.namespace = :namespace', {
        namespace: filters.namespace,
      });
    }

    if (filters?.startDate) {
      query.andWhere('log.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }

    if (filters?.endDate) {
      query.andWhere('log.createdAt <= :endDate', {
        endDate: filters.endDate,
      });
    }

    query.orderBy('log.createdAt', 'DESC').limit(filters?.limit || 100);

    return await query.getMany();
  }

  /**
   * Send audit log to Loki for centralized logging
   */
  private async sendToLoki(log: ActionAuditLog): Promise<void> {
    const lokiUrl = this.configService.get<string>('LOKI_URL');

    if (!lokiUrl) {
      return; // Loki not configured
    }

    try {
      const logEntry = {
        streams: [
          {
            stream: {
              job: 'aegis-executor',
              level: log.status === ActionStatus.FAILED ? 'error' : 'info',
              action_type: log.actionType,
              namespace: log.namespace,
              status: log.status,
            },
            values: [
              [
                String(Date.now() * 1000000), // Nanoseconds
                JSON.stringify({
                  audit_id: log.id,
                  action_type: log.actionType,
                  status: log.status,
                  namespace: log.namespace,
                  resource_type: log.resourceType,
                  resource_name: log.resourceName,
                  requested_by: log.requestedBy,
                  error_message: log.errorMessage,
                  execution_duration: log.executionDuration,
                  timestamp: log.createdAt,
                }),
              ],
            ],
          },
        ],
      };

      await axios.post(`${lokiUrl}/loki/api/v1/push`, logEntry, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });
    } catch (error) {
      this.logger.error(`Failed to send audit log to Loki: ${error.message}`);
      // Don't throw - audit log is already in database
    }
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    total: number;
    completed: number;
    failed: number;
    byType: Record<string, number>;
  }> {
    const total = await this.auditLogRepository.count();
    const completed = await this.auditLogRepository.count({
      where: { status: ActionStatus.COMPLETED },
    });
    const failed = await this.auditLogRepository.count({
      where: { status: ActionStatus.FAILED },
    });

    // Count by type
    const byTypeResult = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.actionType', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.actionType')
      .getRawMany();

    const byType = byTypeResult.reduce((acc, row) => {
      acc[row.type] = parseInt(row.count);
      return acc;
    }, {});

    return { total, completed, failed, byType };
  }
}
