import { Module } from '@nestjs/common';
import { KeysController } from './keys.controller';
import { KeysService } from './keys.service';
import { KeysRepository } from './keys.repository';
import { KeysEncryptionProvider } from './keys-encryption.provider';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [KeysController],
  providers: [KeysService, KeysRepository, KeysEncryptionProvider],
  exports: [KeysService, KeysRepository, KeysEncryptionProvider],
})
export class KeysModule {}
