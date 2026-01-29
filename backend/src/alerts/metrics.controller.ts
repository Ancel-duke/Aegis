import { Controller, Get, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('current')
  @Public()
  async getCurrent() {
    return await this.alertsService.getCurrentMetrics();
  }

  @Get('historical')
  @Public()
  async getHistorical(@Query('days') days?: number) {
    return await this.alertsService.getHistoricalMetrics(
      days ? Number(days) : 7,
    );
  }
}
