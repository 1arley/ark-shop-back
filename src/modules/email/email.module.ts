import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';

@Global()
@Module({
  imports: [ConfigModule, BullModule.registerQueue({ name: 'email' })],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
