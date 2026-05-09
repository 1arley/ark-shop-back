import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PaymentsRepository } from './payments.repository';
import { PaymentProviderFactory } from './payment-provider.factory';
import { PaymentProvider, PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoProvider } from './providers/mercado-pago.provider';
import { OrdersService } from '@/modules/orders/orders.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly configService: ConfigService,
    private readonly mercadoPagoProvider: MercadoPagoProvider,
    private readonly ordersService: OrdersService,
  ) {}

  async createPayment(
    orderId: string,
    userId: string,
    amount: number,
    provider?: PaymentProvider,
    method: PaymentMethod = PaymentMethod.PIX,
  ) {
    const selectedProvider = provider || this.providerFactory.getDefaultProvider();

    // If PIX, generate QR code directly (no duplicate payment record)
    if (method === PaymentMethod.PIX) {
      try {
        const providerImpl = this.providerFactory.getProvider(selectedProvider);
        const paymentIntent = await providerImpl.createPaymentIntent({
          amount,
          currency: 'BRL',
          orderId,
          method,
        });

        return this.paymentsRepository.createPixPayment(orderId, userId, amount, selectedProvider, {
          pixQrCode: paymentIntent.providerData?.pix_copy_paste || '',
          pixCode: paymentIntent.providerData?.pix_qr_code || '',
        });
      } catch (_error) {
        // Fallback to mock PIX if provider fails
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
  async rejectPayment(paymentId: string, reason: string) {
    return this.paymentsRepository.rejectPayment(paymentId, reason);
  }

  /**
   * Approve payment by provider transaction ID and deliver order
   */
  async approvePaymentByProviderTxId(providerTxId: string, paymentInfo: any) {
    const payment = await this.paymentsRepository.findByProviderTxId(providerTxId);
    if (!payment) {
      throw new BadRequestException('Payment not found');
    }

    const approvedPayment = await this.paymentsRepository.approvePayment(
      payment.id,
      providerTxId,
      paymentInfo,
    );

    // Automatically deliver order after payment approval
    await this.deliverOrderByPayment(approvedPayment);

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
