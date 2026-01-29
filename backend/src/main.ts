import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // CORS: specific origin(s) required when credentials are used (cannot use '*')
  const corsOrigin = configService.get<string>('CORS_ORIGIN', 'http://localhost:3001');
  const origins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: origins.length > 0 ? origins : 'http://localhost:3001',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`🚀 Aegis API is running on: http://localhost:${port}/${apiPrefix}`);
}

bootstrap();
