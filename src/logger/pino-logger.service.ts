import { Injectable, LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */

/**
 * PinoLogger wraps the pino logger as a NestJS LoggerService.
 *
 * Uses DI to read LOG_LEVEL from ConfigService so that the log level
 * can be controlled via environment variables and is easy to mock in tests.
 */
@Injectable()
export class PinoLogger implements LoggerService {
  private readonly logger: pino.Logger;

  constructor(private readonly configService: ConfigService) {
    this.logger = pino({
      level: this.configService.get<string>(
        'LOG_LEVEL',
        process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      ),
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: { colorize: true },
            }
          : undefined,
    });
  }

  log(message: any, ...optionalParams: any[]) {
    this.logger.info(message, ...optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.logger.error(message, ...optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.logger.warn(message, ...optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    this.logger.debug(message, ...optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.logger.trace(message, ...optionalParams);
  }
}
