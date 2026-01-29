import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from './metrics.service';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('prometheus')
export class PrometheusMetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Public()
  async getMetrics(@Res() res: Response) {
    res.set('Content-Type', this.metricsService.register.contentType);
    const metrics = await this.metricsService.getMetrics();
    res.send(metrics);
  }
}
