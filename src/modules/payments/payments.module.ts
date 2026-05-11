import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PrismaModule } from '@/prisma/prisma.module';
import { OrdersModule } from '@/modules/orders/orders.module';
import { MercadoPagoProvider } from './providers/mercado-pago.provider';
import { MercadoPagoWebhookHandler } from './webhooks/mercado-pago-webhook.handler';
import { RawBodyMiddleware } from '@/common/middleware/raw-body.middleware';
import { OrdersModule } from '@/modules/orders/orders.module';

@Module({
  imports: [PrismaModule, OrdersModule],
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
export class PaymentsModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply raw body middleware only to webhook endpoints
    consumer.apply(RawBodyMiddleware).forRoutes({
      path: 'payments/webhook/:provider',
      method: RequestMethod.POST,
    });
  }
}
