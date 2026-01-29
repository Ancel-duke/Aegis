import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/** Structured log entry for Loki: method, path, IP, duration, statusCode */
export interface StructuredLogEntry {
  level: string;
  message: string;
  method: string;
  path: string;
  ip: string;
  duration_ms: number;
  statusCode: number;
  userAgent?: string;
  timestamp: string;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const path = request.url?.split('?')[0] ?? request.path ?? '';
    const ip = request.ip ?? request.socket?.remoteAddress ?? '';
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode;
          const duration_ms = Date.now() - startTime;
          const entry: StructuredLogEntry = {
            level: 'info',
            message: `${method} ${path} ${statusCode} ${duration_ms}ms`,
            method,
            path,
            ip,
            duration_ms,
            statusCode,
            userAgent,
            timestamp: new Date().toISOString(),
          };
          this.logger.log(JSON.stringify(entry));
        },
        error: (error: any) => {
          const duration_ms = Date.now() - startTime;
          const statusCode = error.status || 500;
          const entry: StructuredLogEntry = {
            level: statusCode >= 500 ? 'error' : 'warn',
            message: `${method} ${path} ${statusCode} ${duration_ms}ms`,
            method,
            path,
            ip,
            duration_ms,
            statusCode,
            userAgent,
            timestamp: new Date().toISOString(),
          };
          this.logger[statusCode >= 500 ? 'error' : 'warn'](JSON.stringify(entry));
        },
      }),
    );
  }
}
