import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const now = Date.now();

    // Generate or propagate correlation ID
    const correlationId = (request.headers['x-request-id'] as string) || randomUUID();

    request.correlationId = correlationId;
    response.setHeader('X-Request-Id', correlationId);

    const { method, originalUrl } = request;
    const userAgent = request.headers['user-agent'] || '';
    const ip = request.ip || request.socket?.remoteAddress || '';

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - now;
          const statusCode = response.statusCode;

          this.logger.log(
            `[${correlationId}] ${method} ${originalUrl} ${statusCode} ${duration}ms - ${ip} "${userAgent}"`,
          );

          // Warn on slow requests
          if (duration > 2000) {
            this.logger.warn(
              `[${correlationId}] Slow request: ${method} ${originalUrl} took ${duration}ms`,
            );
          }
        },
        error: (error: Error) => {
          const duration = Date.now() - now;

          this.logger.error(
            `[${correlationId}] ${method} ${originalUrl} ${duration}ms - Error: ${error.message}`,
            error.stack,
          );
        },
      }),
    );
  }
}
