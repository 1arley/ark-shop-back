import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';
import { UserModule } from '@/user/user.module';
import { LoggerModule } from '@/logger/logger.module';
import { MetricsModule } from '@/metrics/metrics.module';
import { HealthModule } from '@/health/health.module';

// D'Ark Games Store Modules
import { ProductsModule } from '@/modules/products/products.module';
import { KeysModule } from '@/modules/keys/keys.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { AdminModule } from '@/modules/admin/admin.module';
import { CartModule } from '@/modules/cart/cart.module';
import { AntifraudModule } from '@/modules/antifraud/antifraud.module';
import { EmailModule } from '@/modules/email/email.module';
import { ContactModule } from '@/modules/contact/contact.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { SellersModule } from '@/modules/sellers/sellers.module';
import { UploadModule } from '@/modules/upload/upload.module';
import { WalletModule } from '@/modules/wallet/wallet.module';

// ─── Sentry (optional — 14-day trial) ────────────────────────────
// Só ativa se SENTRY_DSN estiver configurado no ambiente
// Usamos import dinâmico para não travar se o pacote não existir
let sentryModule: any = undefined;
if (process.env.SENTRY_DSN) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const { SentryModule: SM } = require('@sentry/nestjs/setup');
    sentryModule = SM.forRoot();
  } catch {
    // @sentry/nestjs não instalado — segue sem Sentry
  }
}

@Module({
  imports: [
    ...(sentryModule ? [sentryModule] : []),
    ConfigModule.forRoot({
      envFilePath: [
        '.env',
        ...(process.env.NODE_ENV !== 'production' ? ['.env.local'] : []),
        ...(process.env.NODE_ENV === 'test' ? ['.env.test'] : []),
      ],
      isGlobal: true,
    }),

    // ─── Schedule (cron jobs) ─────────────────────────────────────
    ScheduleModule.forRoot(),

    // ─── BullMQ / Redis — lazy connect, não trava se Redis estiver off ──
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          // Não travar a inicialização se Redis estiver offline
          enableReadyCheck: false,
          maxRetriesPerRequest: null,
          lazyConnect: true,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'email',
    }),

    // ─── Rate Limiting ────────────────────────────────────────────
    // General API: 60 requests per minute
    // Auth endpoints have stricter per-route limits (configured in auth.controller)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),

    // ─── Feature Modules ──────────────────────────────────────────
    PrismaModule,
    LoggerModule,
    MetricsModule,
    HealthModule,
    AuthModule,
    UserModule,
    ProductsModule,
    KeysModule,
    OrdersModule,
    PaymentsModule,
    CategoriesModule,
    AdminModule,
    CartModule,
    AntifraudModule,
    EmailModule,
    ContactModule,
    NotificationsModule,
    SellersModule,
    UploadModule,
    WalletModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
