import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PrismaModule } from '@/prisma/prisma.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { AsaasProvider } from './providers/asaas.provider';
import { AsaasWebhookHandler } from './webhooks/asaas-webhook.handler';

@Module({
  imports: [PrismaModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    PaymentProviderFactory,
    AsaasProvider,
    AsaasWebhookHandler,
  ],
  exports: [PaymentsService, PaymentsRepository, PaymentProviderFactory, AsaasProvider],
})
export class PaymentsModule {}
