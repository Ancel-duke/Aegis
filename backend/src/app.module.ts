import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CoreModule } from './core/core.module';
import { MetricsInterceptor } from './core/metrics/metrics.interceptor';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PolicyModule } from './policy/policy.module';
import { ExecutorModule } from './executor/executor.module';
import { AiModule } from './ai/ai.module';
import { AlertsModule } from './alerts/alerts.module';
import { RedisModule } from './common/redis/redis.module';
import { AuditModule } from './audit/audit.module';
import { validateEnvironment } from './common/config/env.validation';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: '.env',
    }),

    // Database - PostgreSQL
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),

    // Rate Limiting (Global)
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('RATE_LIMIT_TTL', 60) * 1000,
            limit: configService.get<number>('RATE_LIMIT_MAX', 100),
          },
        ],
      }),
    }),

    // Redis
    RedisModule,

    // Feature Modules
    AuditModule,
    CoreModule,
    AuthModule,
    UserModule,
    PolicyModule,
    ExecutorModule,
    AiModule,
    AlertsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
