import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { KeysModule } from '@/modules/keys/keys.module';

@Module({
  imports: [
    PrismaModule,
    KeysModule,
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
