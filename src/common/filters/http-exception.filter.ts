import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId =
      request.correlationId || (request.headers['x-request-id'] as string) || 'unknown';

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    const message =
      typeof errorResponse === 'object' && errorResponse !== null && 'message' in errorResponse
        ? (errorResponse as { message: unknown }).message
        : errorResponse;

    // Log all errors
    const logMessage = `[${correlationId}] ${request.method} ${request.url} — ${status}: ${JSON.stringify(message).slice(0, 200)}`;

    if (status >= 500) {
      this.logger.error(logMessage, exception instanceof Error ? exception.stack : undefined);
    } else if (status >= 400) {
      this.logger.warn(logMessage);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      correlationId,
    });
  }
}
