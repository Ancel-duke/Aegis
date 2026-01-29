import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health/health.controller';
import { PrometheusMetricsController } from './metrics/metrics.controller';
import { MetricsService } from './metrics/metrics.service';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [TerminusModule, RedisModule],
  controllers: [HealthController, PrometheusMetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class CoreModule {}
