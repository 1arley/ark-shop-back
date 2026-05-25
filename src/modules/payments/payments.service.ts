import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import { PaymentsRepository } from './payments.repository';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PaymentProvider, PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '@/modules/orders/orders.service';
import { EmailService } from '@/modules/email/email.service';
import { PrismaService } from '@/prisma/prisma.service';
import { toNumber } from '@/common/decimal';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    @Optional() private readonly emailService?: EmailService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async createPayment(
    orderId: string,
    userId: string,
    amount: number,
    provider?: PaymentProvider,
    method: PaymentMethod = PaymentMethod.PIX,
    payerCpf?: string,
    payerBirthDate?: string,
  ) {
    // Verify order ownership — user can only pay for their own orders
    const order = await this.ordersService.findById(orderId);
    if (!order || order.user.id !== userId) {
      throw new BadRequestException('You can only create payments for your own orders');
    }

    // Verify payment amount matches order total — prevent under/overpayment fraud
    const orderTotal = Number(order.total);
    if (Math.abs(orderTotal - amount) > 0.01) {
      throw new BadRequestException('Payment amount does not match order total');
    }

    // Resolve provider: use explicit value or fall back to default
    let selectedProvider = provider || this.providerFactory.getDefaultProvider();

    // Defensive check: ensure the provider is actually registered.
    // Prevents errors when clients send legacy/unimplemented providers (e.g. MERCADO_PAGO).
    const registeredProviders = this.providerFactory.getRegisteredProviders();
    if (!registeredProviders.includes(selectedProvider)) {
      this.logger.warn(
        `Provider ${selectedProvider} is not registered. Falling back to default (ASAAS).`,
      );
      selectedProvider = this.providerFactory.getDefaultProvider();
    }

    // If PIX, generate QR code directly (no duplicate payment record)
    if (method === PaymentMethod.PIX) {
      const providerImpl = this.providerFactory.getProvider(selectedProvider);

      const userEmail = order.user.email ?? undefined;
      const userName = order.user.name ?? undefined;

      const paymentIntent = await providerImpl.createPaymentIntent({
        amount,
        currency: 'BRL',
        orderId,
        method,
        payerEmail: userEmail,
        payerName: userName,
        payerCpf,
        payerBirthDate,
      });

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      return this.paymentsRepository.createPixPayment(orderId, userId, amount, selectedProvider, {
        providerTxId: paymentIntent.id,
        pixQrCode: paymentIntent.providerData?.pix_qr_code || '',
        pixCode: paymentIntent.providerData?.pix_copy_paste || '',
        expiresAt,
      });
    }

    // For other payment methods, create standard payment record
    return this.paymentsRepository.createPayment(orderId, userId, amount, selectedProvider, method);
  }

  async processPayment(paymentId: string, providerTxId: string, webhookData?: any) {
    const payment = await this.paymentsRepository.findById(paymentId);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Payment already processed (status: ${payment.status})`);
    }

    // Verify payment with provider
    const provider = this.providerFactory.getProvider(payment.provider);
    const verification = await provider.verifyPayment(providerTxId);

    if (verification.status === 'approved') {
      return this.paymentsRepository.approvePayment(paymentId, providerTxId, webhookData);
    }

    return this.paymentsRepository.rejectPayment(paymentId, 'Payment not approved');
  }

  async refundPayment(paymentId: string, amount?: number) {
    const payment = await this.paymentsRepository.findById(paymentId);

    if (payment.status !== PaymentStatus.APPROVED) {
      throw new BadRequestException('Can only refund approved payments');
    }

    if (!payment.providerTxId) {
      throw new BadRequestException('Payment missing provider transaction ID');
    }

    const provider = this.providerFactory.getProvider(payment.provider);
    const refundResult = await provider.refundPayment(payment.providerTxId, amount);

    return {
      payment: await this.paymentsRepository.updatePaymentStatus(
        paymentId,
        PaymentStatus.REFUNDED,
        undefined,
        { refundResult },
      ),
      refundResult,
    };
  }

  async getPayment(paymentId: string) {
    return this.paymentsRepository.findById(paymentId);
  }

  async getPaymentByOrderId(orderId: string) {
    return this.paymentsRepository.findByOrderId(orderId);
  }

  async getUserPayments(userId: string, page: number = 1, limit: number = 10) {
    return this.paymentsRepository.getPaymentsByUser(userId, page, limit);
  }

  /**
   * Verify payment with provider (used by webhook)
   */
  async verifyPaymentWithProvider(providerTxId: string) {
    const payment = await this.paymentsRepository.findByProviderTxId(providerTxId);
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    const provider = this.providerFactory.getProvider(payment.provider);
    return provider.verifyPayment(providerTxId);
  }

  /**
   * Approve payment and deliver order
   */
  async approvePayment(paymentId: string, paymentInfo: any) {
    const payment = await this.paymentsRepository.approvePayment(
      paymentId,
      paymentInfo.id,
      paymentInfo,
    );

    // Update order status to PAID and deliver order automatically
    await this.deliverOrderByPayment(payment);

    return payment;
  }

  /**
   * Deliver order after payment approval
   */
  private async deliverOrderByPayment(payment: any) {
    try {
      const order = await this.ordersService.findById(payment.orderId);
      if (order && order.status !== OrderStatus.DELIVERED) {
        this.logger.log(`Delivering order ${order.id} after payment approval`);
        await this.ordersService.deliverOrder(order.id);
        this.logger.log(`Order ${order.id} delivered successfully`);
      }
    } catch (error) {
      this.logger.error('Failed to deliver order after payment approval', error);
      // Don't throw - payment was already approved, delivery failure should not rollback
    }
  }

  /**
   * Reject payment
   */
  async rejectPayment(paymentId: string, reason?: string) {
    return this.paymentsRepository.rejectPayment(paymentId, reason);
  }

  /**
   * Approve payment by provider transaction ID and deliver order
   * Idempotente: se o pagamento já foi aprovado, retorna o registro existente
   * sem tentar entregar o pedido novamente.
   */
  async approvePaymentByProviderTxId(providerTxId: string, paymentInfo: any) {
    const payment = await this.paymentsRepository.findByProviderTxId(providerTxId);

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    // Verify payment amount matches expected amount (prevent fraud)
    if (paymentInfo.value !== undefined && paymentInfo.value !== null) {
      const expectedAmount = Number(payment.amount);
      const receivedAmount = Number(paymentInfo.value);
      if (Number.isNaN(receivedAmount) || Math.abs(expectedAmount - receivedAmount) > 0.01) {
        this.logger.error(
          `Payment amount mismatch: expected ${expectedAmount}, received ${receivedAmount} for payment ${providerTxId}`,
        );
        throw new BadRequestException('Payment amount mismatch');
      }
    }

    // Idempotência: se já aprovado, retorna sem reprocessar
    if (payment.status === PaymentStatus.APPROVED || payment.order?.status === OrderStatus.PAID) {
      this.logger.log(`Payment ${providerTxId} already approved — skipping`);
      return payment;
    }

    const approvedPayment = await this.paymentsRepository.approvePayment(
      payment.id,
      providerTxId,
      paymentInfo,
    );

    // Automatically deliver order after payment approval
    await this.deliverOrderByPayment(approvedPayment);

    // Notify active seller about the split payment (if any)
    if (this.prisma && this.emailService) {
      try {
        const seller = await this.prisma.seller.findFirst({
          where: { isActive: true, asaasWalletId: { not: null } },
          include: { user: { select: { email: true, name: true } } },
        });
        if (seller?.user?.email) {
          const platformCommission = toNumber(seller.commission) ?? 10;
          const sellerPercent = 100 - platformCommission;
          const paymentAmount = toNumber(approvedPayment.amount) ?? 0;
          const sellerAmount = (paymentAmount * sellerPercent) / 100;
          const emailHtml =
            `<p>Olá ${seller.user.name || ''},</p>` +
            `<p>Você recebeu R$ ${sellerAmount.toFixed(2)} referente ao pedido #${approvedPayment.orderId}.</p>` +
            `<p>O valor será creditado na sua conta Asaas.</p>`;
          await this.emailService.send({
            to: seller.user.email,
            subject: `Pagamento recebido - Pedido #${approvedPayment.orderId}`,
            html: emailHtml,
          });
        }
      } catch (err) {
        this.logger.error('Failed to send seller split notification email', err);
      }
    }

    return approvedPayment;
  }

  /**
   * Reject payment by provider transaction ID
   */
  async rejectPaymentByProviderTxId(providerTxId: string, reason: string) {
    const payment = await this.paymentsRepository.findByProviderTxId(providerTxId);
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    return this.paymentsRepository.rejectPayment(payment.id, reason);
  }

  /**
   * Refund payment by provider transaction ID
   */
  async refundPaymentByProviderTxId(providerTxId: string, amount?: number) {
    const payment = await this.paymentsRepository.findByProviderTxId(providerTxId);
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    return this.refundPayment(payment.id, amount);
  }
}
