import { Injectable, BadRequestException } from '@nestjs/common';
import { PaymentsRepository } from './payments.repository';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PaymentProvider, PaymentMethod, PaymentStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly configService: ConfigService,
  ) {}

  async createPayment(
    orderId: string,
    userId: string,
    amount: number,
    provider?: PaymentProvider,
    method: PaymentMethod = PaymentMethod.PIX,
  ) {
    const selectedProvider = provider || this.providerFactory.getDefaultProvider();

    // Create payment record
    const payment = await this.paymentsRepository.createPayment(
      orderId,
      userId,
      amount,
      selectedProvider,
      method,
    );

    // If PIX, generate QR code
    if (method === PaymentMethod.PIX) {
      // In production, use actual payment provider
      const pixData = {
        pixQrCode: `00020126580014BR.GOV.BCB.PIX0136${orderId}520400005303986540${amount.toFixed(2)}5802BR5913D'ARK GAMES6008BRASILIA62070503***6304`,
        pixCode: `00020126580014BR.GOV.BCB.PIX0136${orderId}520400005303986540${amount.toFixed(2)}5802BR5913D'ARK GAMES6008BRASILIA62070503***6304`,
      };

      return this.paymentsRepository.createPixPayment(
        orderId,
        userId,
        amount,
        selectedProvider,
        pixData,
      );
    }

    return payment;
  }

  async processPayment(
    paymentId: string,
    providerTxId: string,
    webhookData?: any,
  ) {
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

    const provider = this.providerFactory.getProvider(payment.provider);
    const refundResult = await provider.refundPayment(payment.providerTxId!, amount);

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
   * Process webhook from payment provider
   */
  async processWebhook(
    provider: PaymentProvider,
    providerTxId: string,
    event: string,
    amount?: number,
  ) {
    const payment = await this.paymentsRepository.findByOrderId(
      // In production, lookup by providerTxId
      providerTxId
    );

    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    switch (event) {
      case 'payment.approved':
        return this.paymentsRepository.approvePayment(payment.id, providerTxId);
      case 'payment.rejected':
        return this.paymentsRepository.rejectPayment(payment.id, event);
      default:
        throw new BadRequestException(`Unknown webhook event: ${event}`);
    }
  }
}
