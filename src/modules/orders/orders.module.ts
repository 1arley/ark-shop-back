import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { KeysModule } from '@/modules/keys/keys.module';
import { AccountsModule } from '@/modules/accounts/accounts.module';
import { CouponsModule } from '@/modules/coupons/coupons.module';

@Module({
  imports: [PrismaModule, KeysModule, AccountsModule, CouponsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
