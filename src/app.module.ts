import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/auth/auth.module';
import { UserModule } from '@/user/user.module';

// D'Ark Games Store Modules
import { ProductsModule } from '@/modules/products/products.module';
import { KeysModule } from '@/modules/keys/keys.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { AdminModule } from '@/modules/admin/admin.module';
import { CartModule } from '@/modules/cart/cart.module';
import { AntifraudModule } from '@/modules/antifraud/antifraud.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env', '.env.local', '.env.test'],
      isGlobal: true,
    }),
    // BullModule com Redis — desabilita graciosamente se Redis não estiver disponível
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
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
    PrismaModule,
    AuthModule,
    UserModule,
    // D'Ark Games Store Modules
    ProductsModule,
    KeysModule,
    OrdersModule,
    PaymentsModule,
    CategoriesModule,
    AdminModule,
    CartModule,
    AntifraudModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
