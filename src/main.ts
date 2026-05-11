import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';

export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const apiPrefix = process.env.API_PREFIX || 'api';
  app.setGlobalPrefix(apiPrefix);

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : undefined;

  if (!corsOrigins && process.env.NODE_ENV === 'production') {
    console.warn('CORS_ORIGIN not configured — allowing all origins');
  }

  app.enableCors({
    origin: corsOrigins ?? true,
    credentials: process.env.CORS_CREDENTIALS === 'true' || true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

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
    customSiteTitle: 'SeedaBit API Docs',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: '.swagger-ui .topbar { display: none }',
  });

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
    console.log(`\n🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
    console.log(`📚 Swagger documentation: http://localhost:${port}/${swaggerPath}\n`);
  } catch (err) {
    console.error('Failed to start application:', err);
    process.exit(1);
  }
}

if (!process.env.VERCEL) {
  void bootstrap();
}
