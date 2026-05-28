import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountsRepository } from './accounts.repository';
import { KeysEncryptionProvider } from '@/modules/keys/keys-encryption.provider';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AccountsController],
  providers: [AccountsService, AccountsRepository, KeysEncryptionProvider],
  exports: [AccountsService, AccountsRepository],
})
export class AccountsModule {}
