import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PrismaModule } from '@/prisma/prisma.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { MercadoPagoProvider } from './providers/mercado-pago.provider';
import { AsaasProvider } from './providers/asaas.provider';
import { MercadoPagoWebhookHandler } from './webhooks/mercado-pago-webhook.handler';
import { AsaasWebhookHandler } from './webhooks/asaas-webhook.handler';

@Module({
  imports: [PrismaModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    PaymentProviderFactory,
    MercadoPagoProvider,
    AsaasProvider,
    MercadoPagoWebhookHandler,
    AsaasWebhookHandler,
  ],
  exports: [
    PaymentsService,
    PaymentsRepository,
    PaymentProviderFactory,
    MercadoPagoProvider,
    AsaasProvider,
  ],
})
export class PaymentsModule {}
