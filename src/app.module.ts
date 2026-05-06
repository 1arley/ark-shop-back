import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env', '.env.local', '.env.test'],
      isGlobal: true,
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
