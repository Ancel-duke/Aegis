import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { RedisService } from '../../common/redis/redis.service';
import { ConfigService } from '@nestjs/config';

describe('HealthController', () => {
  let controller: HealthController;

  const mockHealth = {
    check: jest.fn().mockResolvedValue({
      status: 'ok',
      info: { database: { status: 'up' }, redis: { status: 'up' }, aiEngine: { status: 'up' } },
    }),
  };

  const mockDb = {
    pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
  };

  const mockRedis = {
    getClient: jest.fn().mockReturnValue({
      ping: jest.fn().mockResolvedValue('PONG'),
    }),
  };

  const mockConfig = {
    get: jest.fn((key: string) => (key === 'AI_ENGINE_URL' ? 'http://localhost:8000' : undefined)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealth },
        { provide: TypeOrmHealthIndicator, useValue: mockDb },
        { provide: RedisService, useValue: mockRedis },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should return health check result', async () => {
      const result = await controller.check();
      expect(result).toHaveProperty('status');
      expect(mockHealth.check).toHaveBeenCalled();
    });
  });

  describe('ping', () => {
    it('should return ok and uptime', () => {
      const result = controller.ping();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.uptime).toBe('number');
    });
  });
});
