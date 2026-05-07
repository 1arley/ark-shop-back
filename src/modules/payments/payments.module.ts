import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PrismaModule } from '@/prisma/prisma.module';
import { MercadoPagoProvider } from './providers/mercado-pago.provider';
import { MercadoPagoWebhookHandler } from './webhooks/mercado-pago-webhook.handler';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    PaymentProviderFactory,
    MercadoPagoProvider,
    MercadoPagoWebhookHandler,
  ],
  exports: [PaymentsService, PaymentsRepository, PaymentProviderFactory, MercadoPagoProvider],
})
export class PaymentsModule {}
