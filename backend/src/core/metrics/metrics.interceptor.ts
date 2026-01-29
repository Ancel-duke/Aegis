import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const path = request.url?.split('?')[0] ?? request.path ?? 'unknown';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const status = response.statusCode;
          this.metricsService.recordRequest(method, path, status, Date.now() - start);
        },
        error: (err: any) => {
          const status = err.status || 500;
          this.metricsService.recordRequest(method, path, status, Date.now() - start);
        },
      }),
    );
  }
}
