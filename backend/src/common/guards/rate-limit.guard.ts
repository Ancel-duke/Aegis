import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from '../redis/redis.service';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private reflector: Reflector,
    private redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!rateLimitOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const endpoint = `${request.method}:${request.route.path}`;

    // Create unique key per user and endpoint
    const userId = user?.id || request.ip;
    const key = `rate-limit:${userId}:${endpoint}`;

    try {
      const current = await this.redisService.incr(key);

      if (current === 1) {
        await this.redisService.expire(key, rateLimitOptions.ttl);
      }

      if (current > rateLimitOptions.limit) {
        this.logger.warn(
          `Rate limit exceeded for user ${userId} on endpoint ${endpoint}`,
        );
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests, please try again later',
            error: 'Too Many Requests',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // If Redis is down, allow the request but log the error
      this.logger.error('Rate limiting error, allowing request', error);
      return true;
    }
  }
}
