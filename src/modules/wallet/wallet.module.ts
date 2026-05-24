import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { WalletRepository } from './wallet.repository';
import { WalletService } from './wallet.service';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [WalletRepository, WalletService],
  exports: [WalletService],
})
export class WalletModule {}
