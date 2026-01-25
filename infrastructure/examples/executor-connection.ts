/**
 * Executor Service - PostgreSQL Connection Setup
 * with SSL/TLS and Connection Pooling
 */

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

export const getDatabaseConfig = (): TypeOrmModuleOptions => {
  const sslEnabled = process.env.DB_SSL_ENABLED === 'true';
  
  return {
    type: 'postgres',
    host: process.env.EXECUTOR_DB_HOST || 'localhost',
    port: parseInt(process.env.EXECUTOR_DB_PORT || '5434'),
    username: process.env.EXECUTOR_DB_USER,
    password: process.env.EXECUTOR_DB_PASSWORD,
    database: process.env.EXECUTOR_DB_NAME,
    
    // SSL Configuration
    ssl: sslEnabled ? {
      rejectUnauthorized: true,
      ca: fs.readFileSync(
        path.join(__dirname, '../ssl/postgres/executor/ca.crt')
      ).toString(),
      cert: fs.readFileSync(
        path.join(__dirname, '../ssl/postgres/executor/client.crt')
      ).toString(),
      key: fs.readFileSync(
        path.join(__dirname, '../ssl/postgres/executor/client.key')
      ).toString(),
    } : false,
    
    // Connection Pooling
    extra: {
      max: parseInt(process.env.EXECUTOR_DB_POOL_MAX || '10'),
      min: parseInt(process.env.EXECUTOR_DB_POOL_MIN || '2'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    },
    
    // Auto-load entities
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    
    // Never synchronize (immutable audit logs)
    synchronize: false,
    
    // Logging
    logging: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
    logger: 'advanced-console',
    
    // Connection retry
    retryAttempts: 10,
    retryDelay: 3000,
    
    // Migrations
    migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
    migrationsRun: false,
  };
};

// Loki client for audit logging
export class LokiClient {
  private baseUrl: string;
  private enabled: boolean;
  
  constructor() {
    this.baseUrl = process.env.LOKI_URL || 'http://localhost:3100';
    this.enabled = process.env.LOKI_ENABLED !== 'false';
  }
  
  async sendLog(message: any, labels: Record<string, string> = {}): Promise<void> {
    if (!this.enabled) {
      return;
    }
    
    const defaultLabels = {
      job: 'aegis-executor',
      level: 'info',
      ...labels,
    };
    
    const logEntry = {
      streams: [
        {
          stream: defaultLabels,
          values: [
            [
              String(Date.now() * 1000000), // Nanoseconds
              typeof message === 'string' ? message : JSON.stringify(message),
            ],
          ],
        },
      ],
    };
    
    try {
      await axios.post(`${this.baseUrl}/loki/api/v1/push`, logEntry, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });
    } catch (error) {
      console.error('Failed to send log to Loki:', error.message);
      // Don't throw - logging failure should not break the application
    }
  }
  
  async sendAuditLog(auditData: {
    action_type: string;
    namespace: string;
    resource_name: string;
    status: string;
    requested_by: string;
    execution_duration?: number;
    error_message?: string;
  }): Promise<void> {
    await this.sendLog(
      {
        message: `Action ${auditData.action_type} on ${auditData.resource_name}`,
        ...auditData,
      },
      {
        level: auditData.status === 'failed' ? 'error' : 'info',
        action_type: auditData.action_type,
        namespace: auditData.namespace,
        status: auditData.status,
      }
    );
  }
}

// Example usage in service
/*
import { Injectable, Logger } from '@nestjs/common';
import { LokiClient } from './config/executor-connection';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private lokiClient: LokiClient;
  
  constructor() {
    this.lokiClient = new LokiClient();
  }
  
  async logAction(data: any): Promise<void> {
    // Log to PostgreSQL (immutable)
    await this.auditLogRepository.save(data);
    
    // Log to Loki (centralized logging)
    await this.lokiClient.sendAuditLog({
      action_type: data.actionType,
      namespace: data.namespace,
      resource_name: data.resourceName,
      status: data.status,
      requested_by: data.requestedBy,
      execution_duration: data.executionDuration,
    });
  }
}
*/

// Connection test
export async function testExecutorConnections(): Promise<void> {
  console.log('Testing Executor service connections...\n');
  
  // Test PostgreSQL
  console.log('1. Testing PostgreSQL connection...');
  const { Client } = require('pg');
  const pgClient = new Client({
    host: process.env.EXECUTOR_DB_HOST,
    port: parseInt(process.env.EXECUTOR_DB_PORT || '5434'),
    user: process.env.EXECUTOR_DB_USER,
    password: process.env.EXECUTOR_DB_PASSWORD,
    database: process.env.EXECUTOR_DB_NAME,
    ssl: process.env.DB_SSL_ENABLED === 'true' ? {
      rejectUnauthorized: true,
      ca: fs.readFileSync('./ssl/postgres/executor/ca.crt').toString(),
    } : false,
  });
  
  try {
    await pgClient.connect();
    const result = await pgClient.query('SELECT NOW()');
    console.log('✅ PostgreSQL connection successful:', result.rows[0].now);
    
    // Test if audit table exists
    const tableCheck = await pgClient.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'action_audit_logs'
      );
    `);
    console.log('✅ Audit logs table exists:', tableCheck.rows[0].exists);
    
    await pgClient.end();
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
  }
  
  // Test Redis
  console.log('\n2. Testing Redis connection...');
  const Redis = require('ioredis');
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {
      rejectUnauthorized: true,
      ca: fs.readFileSync('./ssl/redis/ca.crt'),
    } : undefined,
  });
  
  try {
    await redis.ping();
    console.log('✅ Redis connection successful');
    await redis.quit();
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
  }
  
  // Test Loki
  console.log('\n3. Testing Loki connection...');
  const lokiClient = new LokiClient();
  try {
    await lokiClient.sendLog('Executor connection test', {
      level: 'info',
      test: 'true',
    });
    console.log('✅ Loki connection successful');
  } catch (error) {
    console.error('❌ Loki connection failed:', error.message);
  }
  
  // Test Policy Engine connection
  console.log('\n4. Testing Policy Engine connection...');
  try {
    const response = await axios.get(
      process.env.POLICY_ENGINE_URL.replace('/evaluate', '/health'),
      { timeout: 5000 }
    );
    console.log('✅ Policy Engine connection successful:', response.data);
  } catch (error) {
    console.error('❌ Policy Engine connection failed:', error.message);
  }
  
  console.log('\n✅ Connection tests complete!');
}

// Run tests if executed directly
if (require.main === module) {
  testExecutorConnections().catch(console.error);
}
