import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { RedisService } from '../src/common/redis/redis.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
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

  describe('POST /auth/signup', () => {
    const signupDto = {
      email: 'e2e-signup@example.com',
      password: 'Password123!',
      firstName: 'E2E',
      lastName: 'User',
    };

    it('should register a new user and return tokens', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send(signupDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(typeof res.body.accessToken).toBe('string');
          expect(typeof res.body.refreshToken).toBe('string');
        });
    });

    it('should reject duplicate email with 409', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send(signupDto)
        .expect(409);
    });

    it('should reject invalid email with 400', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ ...signupDto, email: 'not-an-email' })
        .expect(400);
    });

    it('should reject short password with 400', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/signup')
        .send({ ...signupDto, email: 'other@example.com', password: 'short' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should return tokens for valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'e2e-signup@example.com',
          password: 'Password123!',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
        });
    });

    it('should return 401 for invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'e2e-signup@example.com',
          password: 'WrongPassword',
        })
        .expect(401);
    });

    it('should return 401 for unknown user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'e2e-signup@example.com',
          password: 'Password123!',
        });
      refreshToken = loginRes.body.refreshToken;
    });

    it('should return new tokens with valid refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
        });
    });

    it('should return 401/403 with invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .expect((res) => expect([401, 403]).toContain(res.status));
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;

    beforeAll(async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'e2e-signup@example.com',
          password: 'Password123!',
        });
      accessToken = loginRes.body.accessToken;
    });

    it('should return 200 and message when authenticated', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toContain('Logged out');
        });
    });

    it('should return 401 without token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(401);
    });
  });
});
