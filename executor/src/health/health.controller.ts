import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(private configService: ConfigService) {}

  @Get()
  check() {
    return {
      status: 'healthy',
      service: 'aegis-executor',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('ping')
  ping() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('config')
  config() {
    return {
      environment: this.configService.get<string>('NODE_ENV'),
      allowedNamespaces: this.configService
        .get<string>('ALLOWED_NAMESPACES', 'default')
        .split(','),
      requireSignature: this.configService.get<boolean>(
        'REQUIRE_ACTION_SIGNATURE',
        true,
      ),
    };
  }
}
