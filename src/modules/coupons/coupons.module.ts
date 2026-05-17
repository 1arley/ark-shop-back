import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';
import { CouponsRepository } from './coupons.repository';

@Module({
  imports: [PrismaModule],
  controllers: [CouponsController],
  providers: [CouponsService, CouponsRepository],
  exports: [CouponsService, CouponsRepository],
})
export class CouponsModule {}
