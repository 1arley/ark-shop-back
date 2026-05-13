import { Module } from '@nestjs/common';
import { SellersController } from './sellers.controller';
import { SellersService } from './sellers.service';
import { SellersRepository } from './sellers.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { UserModule } from '@/user/user.module';
import { PaymentsModule } from '@/modules/payments/payments.module';

@Module({
  imports: [PrismaModule, UserModule, PaymentsModule],
  controllers: [SellersController],
  providers: [SellersService, SellersRepository],
  exports: [SellersService, SellersRepository],
})
export class SellersModule {}
