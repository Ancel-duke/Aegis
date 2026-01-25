import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ActionStatus, ActionType } from './entities/action-audit-log.entity';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  async getAuditLogs(
    @Query('actionType') actionType?: ActionType,
    @Query('status') status?: ActionStatus,
    @Query('namespace') namespace?: string,
    @Query('limit') limit?: number,
  ) {
    return await this.auditService.getAuditLogs({
      actionType,
      status,
      namespace,
      limit: limit ? parseInt(limit.toString()) : 100,
    });
  }

  @Get('statistics')
  async getStatistics() {
    return await this.auditService.getStatistics();
  }
}
