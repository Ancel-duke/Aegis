import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheckResult,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { Public } from '../../auth/decorators/public.decorator';
import { RedisService } from '../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private redisService: RedisService,
    private configService: ConfigService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redisPingCheck(),
      () => this.aiEnginePingCheck(),
    ]);
  }

  private async redisPingCheck(): Promise<HealthIndicatorResult> {
    try {
      const client = this.redisService.getClient();
      await client.ping();
      return { redis: { status: 'up' } } as HealthIndicatorResult;
    } catch (error) {
      throw new Error(`Redis is down: ${(error as Error).message}`);
    }
  }

  private async aiEnginePingCheck(): Promise<HealthIndicatorResult> {
    const url = this.configService.get<string>('AI_ENGINE_URL', 'http://localhost:8000');
    try {
      await axios.get(`${url}/health`, { timeout: 5000 });
      return { aiEngine: { status: 'up' } } as HealthIndicatorResult;
    } catch (error) {
      throw new Error(`AI Engine unreachable: ${(error as Error).message}`);
    }
  }

  @Get('ping')
  @Public()
  ping() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
