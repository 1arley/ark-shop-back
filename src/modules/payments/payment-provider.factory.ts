import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, PaymentProvider } from '@prisma/client';
import { MercadoPagoProvider } from './providers/mercado-pago.provider';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  providerData: any;
}

export interface PaymentProviderInterface {
  name: PaymentProvider;
  createPaymentIntent(data: {
    amount: number;
    currency: string;
    orderId: string;
    method: PaymentMethod;
  }): Promise<PaymentIntent>;
  verifyPayment(providerTxId: string): Promise<{
    status: string;
    amount?: number;
    providerData?: any;
  }>;
  refundPayment(providerTxId: string, amount?: number): Promise<any>;
}

@Injectable()
export class PaymentProviderFactory {
  private readonly providers = new Map<PaymentProvider, PaymentProviderInterface>();

  constructor(
    private readonly configService: ConfigService,
    private readonly mercadoPagoProvider: MercadoPagoProvider,
  ) {
    // Register Mercado Pago
    this.providers.set(PaymentProvider.MERCADO_PAGO, {
      name: PaymentProvider.MERCADO_PAGO,
      createPaymentIntent: this.createMercadoPagoIntent.bind(this),
      verifyPayment: this.verifyMercadoPagoPayment.bind(this),
      refundPayment: this.refundMercadoPagoPayment.bind(this),
    });

    // Stripe and Asaas would be implemented similarly
    // this.providers.set(PaymentProvider.STRIPE, ...)
    // this.providers.set(PaymentProvider.ASAAS, ...)
  }

  private async createMercadoPagoIntent(data: {
    amount: number;
    currency: string;
    orderId: string;
    method: PaymentMethod;
  }): Promise<PaymentIntent> {
    const payment = await this.mercadoPagoProvider.createPayment({
      amount: data.amount,
      description: `Order ${data.orderId}`,
    });

    return {
      id: payment.id,
      amount: payment.transaction_amount,
      currency: 'BRL',
      status: payment.status,
      providerData: payment,
    };
  }

  private async verifyMercadoPagoPayment(providerTxId: string) {
    return this.mercadoPagoProvider.verifyPayment(providerTxId);
  }

  private async refundMercadoPagoPayment(providerTxId: string, amount?: number) {
    return this.mercadoPagoProvider.refundPayment(providerTxId, amount);
  }

  getProvider(provider: PaymentProvider): PaymentProviderInterface {
    const providerImpl = this.providers.get(provider);
    
    if (!providerImpl) {
      throw new BadRequestException(`Payment provider ${provider} not available`);
    }
    
    return providerImpl;
  }

  getDefaultProvider(): PaymentProvider {
    const defaultProvider = this.configService.get<string>('PAYMENT_DEFAULT_PROVIDER', 'MERCADO_PAGO');
    return PaymentProvider[defaultProvider as keyof typeof PaymentProvider] || PaymentProvider.MERCADO_PAGO;
  }

  getRegisteredProviders(): PaymentProvider[] {
    return Array.from(this.providers.keys());
  }
}
