import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from '../payments.service';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Mercado Pago Webhook Handler
 * Handles payment notifications from Mercado Pago
 * Implements signature verification and event processing
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
   * Uses raw body buffer for accurate signature verification
   */
  verifySignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature) {
      this.logger.warn('Webhook signature missing');
      return false;
    }

    if (!this.webhookSecret) {
      // Fail-closed: reject all webhooks if secret is not configured
      this.logger.error('MERCADO_PAGO_WEBHOOK_SECRET is not set. All webhooks rejected.');
      return false;
    }

    try {
      // Ensure we're working with a Buffer
      const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);

      // Compute expected signature using raw body — digest() returns Buffer for binary safety
      const expectedSignature = createHmac('sha256', this.webhookSecret)
        .update(bodyBuffer)
        .digest();

      // Normalize received signature: lowercase hex → Buffer
      const normalizedSig = signature.toLowerCase();
      const sigBuffer = Buffer.from(normalizedSig, 'hex');
      const expectedBuffer = expectedSignature;

      if (sigBuffer.length !== expectedBuffer.length) {
        this.logger.warn('Invalid webhook signature (length mismatch)');
        return false;
      }

      const isValid = timingSafeEqual(sigBuffer, expectedBuffer);

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
   * Process webhook event with retry logic
   * Failed events are retried with exponential backoff
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
          await this.retryWithBackoff('payment.created', () => this.handlePaymentCreated(data));
          break;
        case 'payment.updated':
          await this.retryWithBackoff('payment.updated', () => this.handlePaymentUpdated(data));
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
    // Validate data structure
    if (!data || typeof data !== 'object') {
      this.logger.warn('Invalid webhook data structure');
      throw new Error('Invalid webhook data');
    }

    // Safe type checking for payment ID
    const providerPaymentId = typeof data.id === 'string' ? data.id : String(data.id || '');

    if (!providerPaymentId || providerPaymentId === 'undefined' || providerPaymentId === 'null') {
      this.logger.warn('Payment ID missing or invalid in webhook data');
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
    // Validate data structure
    if (!data || typeof data !== 'object') {
      this.logger.warn('Invalid webhook data structure');
      throw new Error('Invalid webhook data');
    }

    // Safe type checking for payment ID
    const providerPaymentId = typeof data.id === 'string' ? data.id : String(data.id || '');

    if (!providerPaymentId || providerPaymentId === 'undefined' || providerPaymentId === 'null') {
      this.logger.warn('Payment ID missing or invalid in webhook data');
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
        await this.paymentsService.rejectPaymentByProviderTxId(
          providerPaymentId,
          paymentInfo.status,
        );
        break;
      case 'refunded':
        await this.paymentsService.refundPaymentByProviderTxId(providerPaymentId);
        break;
    }
  }

  private async handlePaymentDeleted(data: any) {
    // Validate data structure
    if (!data || typeof data !== 'object') {
      this.logger.warn('Invalid webhook data structure');
      throw new Error('Invalid webhook data');
    }

    // Safe type checking for payment ID
    const providerPaymentId = typeof data.id === 'string' ? data.id : String(data.id || '');

    if (!providerPaymentId || providerPaymentId === 'undefined' || providerPaymentId === 'null') {
      this.logger.warn('Payment ID missing or invalid in webhook data');
      throw new Error('Payment ID missing');
    }

    this.logger.log(`Payment deleted: ${providerPaymentId}`);
    await this.paymentsService.rejectPaymentByProviderTxId(providerPaymentId, 'deleted');
  }

  /**
   * Retry a handler function with exponential backoff
   * Used for idempotent operations like payment approval
   */
  private async retryWithBackoff(
    operation: string,
    handlerFn: () => Promise<void>,
    attempt: number = 1,
    maxAttempts: number = 3,
  ): Promise<void> {
    try {
      await handlerFn();
      if (attempt > 1) {
        this.logger.log(`Retry attempt ${attempt} succeeded for operation: ${operation}`);
      }
    } catch (error: any) {
      if (attempt >= maxAttempts) {
        this.logger.error(
          `Max retry attempts (${maxAttempts}) reached for operation: ${operation}. Error: ${error.message}`,
        );
        throw error;
      }

      const delay = Math.min(Math.pow(2, attempt) * 1000, 10_000); // 2s, 4s, 8s, capped at 10s
      this.logger.warn(
        `Operation ${operation} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms...`,
      );

      await this.sleep(delay);
      return this.retryWithBackoff(operation, handlerFn, attempt + 1, maxAttempts);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
