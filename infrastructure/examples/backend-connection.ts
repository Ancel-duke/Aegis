/**
 * Backend Service - PostgreSQL Connection Setup
 * with SSL/TLS and Connection Pooling
 */

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const sslEnabled = process.env.DB_SSL_ENABLED === 'true';
  
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    
    // SSL Configuration
    ssl: sslEnabled ? {
      rejectUnauthorized: true,
      ca: fs.readFileSync(
        path.join(__dirname, '../ssl/postgres/backend/ca.crt')
      ).toString(),
      cert: fs.readFileSync(
        path.join(__dirname, '../ssl/postgres/backend/client.crt')
      ).toString(),
      key: fs.readFileSync(
        path.join(__dirname, '../ssl/postgres/backend/client.key')
      ).toString(),
    } : false,
    
    // Connection Pooling
    extra: {
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      min: parseInt(process.env.DB_POOL_MIN || '2'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      // Keep-alive to detect broken connections
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    },
    
    // Auto-load entities
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    
    // Synchronize only in development
    synchronize: process.env.NODE_ENV === 'development',
    
    // Logging
    logging: process.env.NODE_ENV === 'development' ? 'all' : ['error'],
    logger: 'advanced-console',
    
    // Connection retry
    retryAttempts: 10,
    retryDelay: 3000,
    
    // Migrations
    migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
    migrationsRun: false,
  };
};

// Example usage in app.module.ts
/*
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(getDatabaseConfig()),
  ],
})
export class AppModule {}
*/

// Connection test
export async function testDatabaseConnection(): Promise<boolean> {
  const { Client } = require('pg');
  
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: process.env.DB_SSL_ENABLED === 'true' ? {
      rejectUnauthorized: true,
      ca: fs.readFileSync('./ssl/postgres/backend/ca.crt').toString(),
    } : false,
  });
  
  try {
    await client.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connection successful:', result.rows[0]);
    await client.end();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Redis connection setup
export const getRedisConfig = () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  
  // TLS/SSL
  tls: process.env.REDIS_TLS === 'true' ? {
    rejectUnauthorized: true,
    ca: fs.readFileSync('./ssl/redis/ca.crt'),
    cert: fs.readFileSync('./ssl/redis/client.crt'),
    key: fs.readFileSync('./ssl/redis/client.key'),
  } : undefined,
  
  // Connection options
  retryStrategy: (times: number) => {
    if (times > 10) {
      return null; // Stop retrying
    }
    return Math.min(times * 100, 3000);
  },
  
  // Keep-alive
  keepAlive: 30000,
  
  // Max retry time
  maxRetriesPerRequest: 3,
});

// Example Redis connection test
export async function testRedisConnection(): Promise<boolean> {
  const Redis = require('ioredis');
  const redis = new Redis(getRedisConfig());
  
  try {
    await redis.ping();
    console.log('✅ Redis connection successful');
    await redis.quit();
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    return false;
  }
}
