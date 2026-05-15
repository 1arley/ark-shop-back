// IMPORTANT: instrument.ts must be imported first — initializes Sentry before anything else
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PinoLogger } from '@/logger/pino-logger.service';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

const logger = new Logger('Bootstrap');

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

  // ─── API Prefix ───────────────────────────────────────────────────
  const apiPrefix = process.env.API_PREFIX || 'api';
  app.setGlobalPrefix(apiPrefix);

  // ─── CORS ─────────────────────────────────────────────────────────
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : undefined;

  if (!corsOrigins && process.env.NODE_ENV === 'production') {
    logger.warn(
      'CORS_ORIGIN not configured — allowing all origins. Set CORS_ORIGIN for production.',
    );
  }

  const corsOrigin = corsOrigins ?? true;

  if (corsOrigin === true && process.env.CORS_CREDENTIALS !== 'false') {
    logger.warn(
      'CORS_ORIGIN not configured — credentials mode requires explicit origin. ' +
        'Falling back to request origin. Set CORS_ORIGIN for production.',
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

  // ─── Swagger / OpenAPI ────────────────────────────────────────────
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
    const swaggerPath = process.env.SWAGGER_PATH || 'api/docs';

    await app.listen(port);

    logger.log(`Application is running on: http://localhost:${port}/${apiPrefix}`);
    logger.log(`Swagger documentation: http://localhost:${port}/${swaggerPath}`);

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
