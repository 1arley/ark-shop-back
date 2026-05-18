// IMPORTANT: instrument.ts must be imported first — initializes Sentry before anything else
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication, Logger, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PinoLogger } from '@/logger/pino-logger.service';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';

// Logger declared BEFORE process handlers to avoid ReferenceError on startup crashes
const logger = new Logger('Bootstrap');

// Safety net: log unhandled rejections instead of crashing
process.on('unhandledRejection', reason => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error(`Unhandled Promise Rejection: ${message}`);
});

process.on('uncaughtException', error => {
  logger.error(`Uncaught Exception: ${String(error)}`);
});

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Preserva req.rawBody para verificação de assinatura de webhooks
    // sem interferir no parser JSON normal do Express/NestJS
    rawBody: true,
  });

  // ─── Pino Logger (global substituto do Logger padrão do Nest) ──────
  app.useLogger(app.get(PinoLogger));

  // ─── Security Headers (Helmet) ────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(cookieParser());

  // ─── Request Body Size Limit (DoS prevention) ───────────────────
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ limit: '1mb', extended: true }));

  // ─── API Prefix ───────────────────────────────────────────────────
  const apiPrefix = process.env.API_PREFIX || 'api';
  app.setGlobalPrefix(apiPrefix);

  // ─── API Versioning (URI-based: /api/v1/...) ─────────────────────
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  // ─── CORS ─────────────────────────────────────────────────────────
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : undefined;

  // In production, CORS_ORIGIN must be explicitly configured — no fallback to allow-all
  const corsOrigin = corsOrigins ?? (process.env.NODE_ENV === 'production' ? [] : true);

  if (!corsOrigins && process.env.NODE_ENV === 'production') {
    logger.warn(
      'CORS_ORIGIN not configured in production — blocking all cross-origin requests. ' +
        'Set CORS_ORIGIN to allow your frontend domain.',
    );
  }

  app.enableCors({
    origin: corsOrigin,
    credentials: process.env.CORS_CREDENTIALS !== 'false',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });

  // ─── Global Exception Filter ──────────────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ─── Global Logging Interceptor ───────────────────────────────────
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ─── Global Validation Pipe ───────────────────────────────────────
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

  // ─── Swagger / OpenAPI (development only) ───────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle("D'Ark Games Store API")
      .setDescription(
        "D'Ark Games Store - Digital game keys marketplace with secure transactions and instant delivery",
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('health', 'Endpoints de health check')
      .addTag('auth', 'Endpoints de autenticação')
      .addTag('user', 'Gerenciamento de usuários')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const swaggerPath = process.env.SWAGGER_PATH || 'api/docs';
    SwaggerModule.setup(swaggerPath, app, document, {
      customSiteTitle: "D'Ark Games Store API Docs",
      customfavIcon: 'https://nestjs.com/img/logo-small.svg',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  // ─── Graceful Shutdown ────────────────────────────────────────────
  app.enableShutdownHooks();

  await app.init();
  return app;
}

async function bootstrap() {
  try {
    const app = await createApp();
    const port = process.env.PORT || 3000;
    const apiPrefix = process.env.API_PREFIX || 'api';

    await app.listen(port);

    logger.log(`Application is running on: http://localhost:${port}/${apiPrefix}/v1`);
    if (process.env.NODE_ENV !== 'production') {
      const swaggerPath = process.env.SWAGGER_PATH || 'api/docs';
      logger.log(`Swagger documentation: http://localhost:${port}/${swaggerPath}`);
    }

    // ─── Graceful Shutdown Handlers ───────────────────────────────
    const signals = ['SIGTERM', 'SIGINT'];
    for (const signal of signals) {
      process.on(signal, () => {
        logger.log(`Received ${signal} — starting graceful shutdown...`);
        const shutdownTimeout = setTimeout(() => {
          logger.error('Forced shutdown after timeout');
          process.exit(1);
        }, 30_000); // 30s max for graceful shutdown
        shutdownTimeout.unref();

        app
          .close()
          .then(() => {
            logger.log('Application closed gracefully');
            process.exit(0);
          })
          .catch(() => {
            logger.error('Error during shutdown');
            process.exit(1);
          });
      });
    }
  } catch (_err) {
    logger.error('Failed to start application');
    process.exit(1);
  }
}

void bootstrap();
