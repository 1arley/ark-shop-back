import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentMethod, PaymentProvider } from '@prisma/client';
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
    private readonly prisma: PrismaService,
    private readonly asaasProvider: AsaasProvider,
  ) {
    // Register Asaas (primary provider for marketplace)
    this.providers.set(PaymentProvider.ASAAS, {
      name: PaymentProvider.ASAAS,
      createPaymentIntent: this.createAsaasIntent.bind(this),
      verifyPayment: this.verifyAsaasPayment.bind(this),
      refundPayment: this.refundAsaasPayment.bind(this),
    });
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

    // Busca o pedido para obter o userId do comprador
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      select: { userId: true },
    });

    if (!order) {
      throw new BadRequestException(`Order not found: ${data.orderId}`);
    }

    // Cria/obtém o customer Asaas para o comprador (cacheado por usuário)
    const customerId = await this.ensureCustomer(order.userId, data);

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
      providerData: {
        id: payment.id,
        transaction_amount: payment.value,
        status: payment.status,
        pix_qr_code: payment.pixQrCode,
        pix_copy_paste: payment.pixCopyPaste,
        asaasPaymentId: payment.id,
        split: payment.split,
      },
    };
  }

  /**
   * Garante que o comprador tem um customer_id na Asaas
   * Cacheia o customerId no usuário para evitar criar toda vez
   */
  private async ensureCustomer(
    userId: string,
    data: {
      payerEmail?: string;
      payerName?: string;
      payerCpf?: string;
    },
  ): Promise<string> {
    // Busca o customerId já salvo no usuário
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { asaasCustomerId: true },
    });

    if (user?.asaasCustomerId) {
      return user.asaasCustomerId;
    }

    // Cria customer na Asaas com dados do comprador
    const customerId = await this.asaasProvider.createCustomer({
      name: data.payerName || 'Cliente',
      email: data.payerEmail || 'cliente@email.com',
      cpfCnpj: data.payerCpf,
    });

    // Salva o customerId no usuário para reutilização futura
    await this.prisma.user.update({
      where: { id: userId },
      data: { asaasCustomerId: customerId },
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
    const defaultProvider = this.configService.get<string>('PAYMENT_DEFAULT_PROVIDER', 'ASAAS');
    return (
      PaymentProvider[defaultProvider as keyof typeof PaymentProvider] || PaymentProvider.ASAAS
    );
  }

  getRegisteredProviders(): PaymentProvider[] {
    return Array.from(this.providers.keys());
  }
}
