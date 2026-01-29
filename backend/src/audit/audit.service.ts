import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent, AuditEventType } from './entities/audit-event.entity';

export interface LogAuthEventParams {
  eventType: AuditEventType;
  userId?: string;
  email?: string;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  reason?: string;
}

export interface LogUserChangeParams {
  eventType: AuditEventType;
  userId: string;
  entityId: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditRepository: Repository<AuditEvent>,
  ) {}

  async logAuthEvent(params: LogAuthEventParams): Promise<void> {
    try {
      const event = this.auditRepository.create({
        eventType: params.eventType,
        userId: params.userId,
        details: {
          email: params.email,
          success: params.success,
          reason: params.reason,
        },
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      await this.auditRepository.save(event);
    } catch (error) {
      this.logger.error(`Failed to log auth event: ${error.message}`);
    }
  }

  async logUserChange(params: LogUserChangeParams): Promise<void> {
    try {
      const event = this.auditRepository.create({
        eventType: params.eventType,
        userId: params.userId,
        entityType: 'user',
        entityId: params.entityId,
        details: params.details ?? {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      await this.auditRepository.save(event);
    } catch (error) {
      this.logger.error(`Failed to log user change: ${error.message}`);
    }
  }

  async logGeneric(
    eventType: AuditEventType,
    params: {
      userId?: string;
      entityType?: string;
      entityId?: string;
      details?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<void> {
    try {
      const event = this.auditRepository.create({
        eventType,
        userId: params.userId,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details ?? {},
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
      await this.auditRepository.save(event);
    } catch (error) {
      this.logger.error(`Failed to log audit event: ${error.message}`);
    }
  }
}
