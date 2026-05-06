import { Module } from '@nestjs/common';
import { AntifraudController } from './antifraud.controller';
import { AntifraudService } from './antifraud.service';
import { AntifraudRepository } from './antifraud.repository';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AntifraudController],
  providers: [AntifraudService, AntifraudRepository],
  exports: [AntifraudService, AntifraudRepository],
})
export class AntifraudModule {}
