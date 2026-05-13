import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, PaymentProvider } from '@prisma/client';
import { MercadoPagoProvider } from './providers/mercado-pago.provider';
import { AsaasProvider } from './providers/asaas.provider';

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
    payerEmail?: string;
    payerName?: string;
    payerCpf?: string;
    payerBirthDate?: string;
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
    private readonly asaasProvider: AsaasProvider,
  ) {
    // Register Mercado Pago
    this.providers.set(PaymentProvider.MERCADO_PAGO, {
      name: PaymentProvider.MERCADO_PAGO,
      createPaymentIntent: this.createMercadoPagoIntent.bind(this),
      verifyPayment: this.verifyMercadoPagoPayment.bind(this),
      refundPayment: this.refundMercadoPagoPayment.bind(this),
    });

    // Register Asaas (primary provider for marketplace)
    this.providers.set(PaymentProvider.ASAAS, {
      name: PaymentProvider.ASAAS,
      createPaymentIntent: this.createAsaasIntent.bind(this),
      verifyPayment: this.verifyAsaasPayment.bind(this),
      refundPayment: this.refundAsaasPayment.bind(this),
    });
  }

  // ─── Mercado Pago ────────────────────────────────────────────────

  private async createMercadoPagoIntent(data: {
    amount: number;
    currency: string;
    orderId: string;
    method: PaymentMethod;
    payerEmail?: string;
    payerName?: string;
    payerCpf?: string;
    payerBirthDate?: string;
  }): Promise<PaymentIntent> {
    const payment = await this.mercadoPagoProvider.createPayment({
      amount: data.amount,
      description: `Order ${data.orderId}`,
      payerEmail: data.payerEmail,
      payerName: data.payerName,
      payerDocument: data.payerCpf,
      externalReference: data.orderId,
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

  // ─── Asaas ───────────────────────────────────────────────────────

  private async createAsaasIntent(data: {
    amount: number;
    currency: string;
    orderId: string;
    method: PaymentMethod;
    payerEmail?: string;
    payerName?: string;
    payerCpf?: string;
    payerBirthDate?: string;
  }): Promise<PaymentIntent> {
    // Busca seller wallet para split automático
    const sellerInfo = await this.asaasProvider.getSellerWalletForOrder(data.orderId);

    // Cria/obtém o customer Asaas para o comprador
    // Em produção, você deve armazenar o customerId no User após o primeiro pagamento
    const customerId = await this.ensureCustomer(data);

    const payment = await this.asaasProvider.createPayment({
      amount: data.amount,
      description: `Pedido #${data.orderId.slice(0, 8)}`,
      customer: customerId,
      externalReference: data.orderId,
      payerEmail: data.payerEmail,
      payerName: data.payerName,
      payerCpf: data.payerCpf,
      sellerWalletId: sellerInfo?.walletId || undefined,
      commissionPercent: sellerInfo?.commission || 10,
    });

    return {
      id: payment.id,
      amount: payment.value,
      currency: 'BRL',
      status: payment.status,
      providerData: payment,
    };
  }

  /**
   * Garante que o comprador tem um customer_id na Asaas
   * TODO: cachear customerId por usuário para evitar criar toda vez
   */
  private async ensureCustomer(data: {
    payerEmail?: string;
    payerName?: string;
    payerCpf?: string;
  }): Promise<string> {
    // Cria customer na Asaas com dados do comprador
    const customerId = await this.asaasProvider.createCustomer({
      name: data.payerName || 'Cliente',
      email: data.payerEmail || 'cliente@email.com',
      cpfCnpj: data.payerCpf,
    });
    return customerId;
  }

  private async verifyAsaasPayment(providerTxId: string) {
    return this.asaasProvider.verifyPayment(providerTxId);
  }

  private async refundAsaasPayment(providerTxId: string, amount?: number) {
    return this.asaasProvider.refundPayment(providerTxId, amount);
  }

  // ─── Provider Resolution ─────────────────────────────────────────

  getProvider(provider: PaymentProvider): PaymentProviderInterface {
    const providerImpl = this.providers.get(provider);

    if (!providerImpl) {
      throw new BadRequestException(`Payment provider ${provider} not available`);
    }

    return providerImpl;
  }

  getDefaultProvider(): PaymentProvider {
    const defaultProvider = this.configService.get<string>(
      'PAYMENT_DEFAULT_PROVIDER',
      'ASAAS', // ← Alterado de MERCADO_PAGO para ASAAS
    );
    return (
      PaymentProvider[defaultProvider as keyof typeof PaymentProvider] || PaymentProvider.ASAAS
    );
  }

  getRegisteredProviders(): PaymentProvider[] {
    return Array.from(this.providers.keys());
  }
}
