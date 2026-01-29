import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { createHmac } from 'crypto';
import { AppModule } from '../src/app.module';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../src/common/redis/redis.service';

describe('ExecutorController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.EXECUTOR_HMAC_SECRET = 'e2e-secret';
    process.env.EXECUTOR_NAMESPACE_ALLOWLIST = 'default,aegis';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useValue({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue(false),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /executor/health returns ok', () => {
    return request(app.getHttpServer())
      .get('/api/v1/executor/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it('POST /executor/action with valid HMAC logs and returns id', () => {
    const timestamp = String(Date.now());
    const payload = ['restart_pod', 'default', 'pod', 'my-pod', timestamp].join('|');
    const signature = createHmac('sha256', 'e2e-secret').update(payload).digest('hex');
    return request(app.getHttpServer())
      .post('/api/v1/executor/action')
      .send({
        actionType: 'restart_pod',
        namespace: 'default',
        resourceType: 'pod',
        resourceName: 'my-pod',
        timestamp,
        signature,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body).toHaveProperty('status');
      });
  });
});
