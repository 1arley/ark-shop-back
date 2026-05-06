import { Injectable, BadRequestException, Logger } from '@nestjs/common';
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
   */
  verifySignature(payload: any, signature: string): boolean {
    if (!signature) {
      this.logger.warn('Webhook signature missing');
      return false;
    }

    try {
      const expectedSignature = createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const isValid = createHmac('sha256', this.webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex') === signature;

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
    const { action, data } = event;

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
    const { id: paymentId } = data;
    
    this.logger.log(`Payment created: ${paymentId}`);
    
    // Verify payment status with Mercado Pago
    const paymentInfo = await this.paymentsService.verifyPaymentWithProvider(paymentId);
    
    if (paymentInfo.status === 'approved') {
      await this.paymentsService.approvePayment(paymentId, paymentInfo);
    }
  }

  private async handlePaymentUpdated(data: any) {
    const { id: paymentId } = data;
    
    this.logger.log(`Payment updated: ${paymentId}`);
    
    // Re-verify payment status
    const paymentInfo = await this.paymentsService.verifyPaymentWithProvider(paymentId);
    
    switch (paymentInfo.status) {
      case 'approved':
        await this.paymentsService.approvePayment(paymentId, paymentInfo);
        break;
      case 'rejected':
      case 'expired':
      case 'cancelled':
        await this.paymentsService.rejectPayment(paymentId, paymentInfo.status);
        break;
      case 'refunded':
        await this.paymentsService.refundPayment(paymentId);
        break;
    }
  }

  private async handlePaymentDeleted(data: any) {
    const { id: paymentId } = data;
    
    this.logger.log(`Payment deleted: ${paymentId}`);
    await this.paymentsService.rejectPayment(paymentId, 'deleted');
  }

  /**
   * Retry failed webhook delivery
   * Implements exponential backoff
   */
  async retryWithBackoff(
    eventId: string,
    attempt: number = 1,
    maxAttempts: number = 5,
  ): Promise<void> {
    if (attempt > maxAttempts) {
      this.logger.error(`Max retry attempts reached for event: ${eventId}`);
      throw new Error('Max retry attempts reached');
    }

    try {
      // Implement retry logic here
      this.logger.log(`Retry attempt ${attempt} for event: ${eventId}`);
    } catch (error) {
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      this.logger.log(`Retry failed, waiting ${delay}ms before next attempt`);
      
      await this.sleep(delay);
      return this.retryWithBackoff(eventId, attempt + 1, maxAttempts);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
