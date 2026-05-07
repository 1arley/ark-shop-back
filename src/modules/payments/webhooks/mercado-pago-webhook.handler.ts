import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from '../payments.service';
import { createHmac } from 'crypto';

/**
 * Mercado Pago Webhook Handler
 * Handles payment notifications from Mercado Pago
 * Implements signature verification and retry logic
 */
@Injectable()
export class MercadoPagoWebhookHandler {
  private readonly logger = new Logger(MercadoPagoWebhookHandler.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get<string>('MERCADO_PAGO_WEBHOOK_SECRET') || '';
  }

  /**
   * Verify webhook signature
   * Mercado Pago sends X-Signature header with HMAC-SHA256 signature
   * Note: For production, use Mercado Pago's public key to verify signatures
   * This implementation uses a shared secret for simplicity
   */
  verifySignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature) {
      this.logger.warn('Webhook signature missing');
      return false;
    }

    if (!this.webhookSecret) {
      // If no secret configured, skip verification (dev mode)
      this.logger.warn('Webhook secret not configured, skipping verification');
      return true;
    }

    try {
      // Compute expected signature using raw body
      const expectedSignature = createHmac('sha256', this.webhookSecret)
        .update(rawBody)
        .digest('hex');

      const isValid = expectedSignature === signature;

      if (!isValid) {
        this.logger.warn('Invalid webhook signature');
      }

      return isValid;
    } catch (error) {
      this.logger.error('Signature verification failed', error);
      return false;
    }
  }

  /**
   * Process webhook event
   */
  async handleEvent(event: any) {
    // Validate payload structure
    if (!event || typeof event !== 'object') {
      this.logger.warn('Invalid webhook payload: not an object');
      throw new Error('Invalid webhook payload');
    }

    const { action, data } = event;

    if (!action || typeof action !== 'string') {
      this.logger.warn('Webhook action missing or invalid');
      throw new Error('Webhook action missing');
    }

    this.logger.log(`Processing webhook event: ${action}`);

    try {
      switch (action) {
        case 'payment.created':
          await this.handlePaymentCreated(data);
          break;
        case 'payment.updated':
          await this.handlePaymentUpdated(data);
          break;
        case 'payment.deleted':
          await this.handlePaymentDeleted(data);
          break;
        default:
          this.logger.warn(`Unhandled event type: ${action}`);
      }
    } catch (error) {
      this.logger.error(`Failed to process webhook event: ${action}`, error);
      throw error;
    }
  }

  private async handlePaymentCreated(data: any) {
    // Mercado Pago sends payment ID in data.id
    const { id: providerPaymentId } = data;

    if (!providerPaymentId) {
      this.logger.warn('Payment ID missing in webhook data');
      throw new Error('Payment ID missing');
    }

    this.logger.log(`Payment created: ${providerPaymentId}`);

    // Verify payment status with Mercado Pago using provider's payment ID
    const paymentInfo = await this.paymentsService.verifyPaymentWithProvider(providerPaymentId);

    if (paymentInfo.status === 'approved') {
      // Find our internal payment ID and approve
      await this.paymentsService.approvePaymentByProviderTxId(providerPaymentId, paymentInfo);
    }
  }

  private async handlePaymentUpdated(data: any) {
    // Mercado Pago sends payment ID in data.id
    const { id: providerPaymentId } = data;

    if (!providerPaymentId) {
      this.logger.warn('Payment ID missing in webhook data');
      throw new Error('Payment ID missing');
    }

    this.logger.log(`Payment updated: ${providerPaymentId}`);

    // Re-verify payment status
    const paymentInfo = await this.paymentsService.verifyPaymentWithProvider(providerPaymentId);

    switch (paymentInfo.status) {
      case 'approved':
        await this.paymentsService.approvePaymentByProviderTxId(providerPaymentId, paymentInfo);
        break;
      case 'rejected':
      case 'expired':
      case 'cancelled':
        await this.paymentsService.rejectPaymentByProviderTxId(providerPaymentId, paymentInfo.status);
        break;
      case 'refunded':
        await this.paymentsService.refundPaymentByProviderTxId(providerPaymentId);
        break;
    }
  }

  private async handlePaymentDeleted(data: any) {
    // Mercado Pago sends payment ID in data.id
    const { id: providerPaymentId } = data;

    if (!providerPaymentId) {
      this.logger.warn('Payment ID missing in webhook data');
      throw new Error('Payment ID missing');
    }

    this.logger.log(`Payment deleted: ${providerPaymentId}`);
    await this.paymentsService.rejectPaymentByProviderTxId(providerPaymentId, 'deleted');
  }

  /**
   * Retry failed webhook delivery
   * Implements exponential backoff
   * Note: This is a placeholder - actual implementation would need
   * to store failed events and retry them asynchronously
   */
  async retryWithBackoff(
    eventId: string,
    attempt: number = 1,
    maxAttempts: number = 5,
    handlerFn?: () => Promise<void>,
  ): Promise<void> {
    if (attempt > maxAttempts) {
      this.logger.error(`Max retry attempts reached for event: ${eventId}`);
      throw new Error('Max retry attempts reached');
    }

    try {
      if (handlerFn) {
        await handlerFn();
      }
      this.logger.log(`Retry attempt ${attempt} succeeded for event: ${eventId}`);
    } catch (error: any) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s, 16s, 32s
      this.logger.warn(`Retry ${attempt} failed for event ${eventId}, waiting ${delay}ms`);

      await this.sleep(delay);
      return this.retryWithBackoff(eventId, attempt + 1, maxAttempts, handlerFn);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
