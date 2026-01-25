import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;
  private isConnected = false;

  constructor(private configService: ConfigService) {
    this.initializeClient();
  }

  private async initializeClient() {
    this.client = createClient({
      socket: {
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
      },
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis Client Error', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      this.logger.log('Redis Client Connected');
      this.isConnected = true;
    });

    try {
      await this.client.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping get operation');
      return null;
    }
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping set operation');
      return;
    }
    if (ttlSeconds) {
      await this.client.setEx(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping delete operation');
      return;
    }
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, returning 0 for incr');
      return 0;
    }
    return await this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (!this.isConnected) {
      this.logger.warn('Redis not connected, skipping expire operation');
      return;
    }
    await this.client.expire(key, seconds);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }
    const result = await this.client.exists(key);
    return result === 1;
  }

  getClient(): RedisClientType {
    return this.client;
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.client.quit();
      this.logger.log('Redis Client Disconnected');
    }
  }
}
