import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';
import { UserModule } from '@/user/user.module';
import { LoggerModule } from '@/logger/logger.module';
import { MetricsModule } from '@/metrics/metrics.module';
import { HealthModule } from '@/health/health.module';

import { validateEnv } from '@/config/env.validation';

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
import { CouponsModule } from '@/modules/coupons/coupons.module';

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
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    LoggerModule,
    MetricsModule,
    HealthModule,
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
    CouponsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ...(process.env.NODE_ENV !== 'test'
      ? [
          {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
          },
        ]
      : []),
  ],
})
export class AppModule {}
