import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { EmailService } from './email.service';
import { Logger } from '@nestjs/common';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  @Process('send-order-confirmation')
  async handleOrderConfirmation(job: Job) {
    const { to, order, items } = job.data;
    this.logger.log(`Sending order confirmation to ${to}`);
    
    try {
      await this.emailService.sendOrderConfirmation(to, order, items);
      this.logger.log(`Order confirmation sent to ${to}`);
    } catch (error: any) {
      this.logger.error(`Failed to send order confirmation: ${error.message || error}`);
      throw error;
    }
  }

  @Process('send-key-delivery')
  async handleKeyDelivery(job: Job) {
    const { to, order, keys } = job.data;
    this.logger.log(`Sending key delivery to ${to}`);
    
    try {
      await this.emailService.sendKeyDelivery(to, order, keys);
      this.logger.log(`Keys delivered to ${to}`);
    } catch (error: any) {
      this.logger.error(`Failed to send key delivery: ${error.message || error}`);
      throw error;
    }
  }

  @Process('send-password-reset')
  async handlePasswordReset(job: Job) {
    const { to, resetToken, email } = job.data;
    this.logger.log(`Sending password reset to ${to}`);
    
    try {
      await this.emailService.sendPasswordReset(to, resetToken, email);
      this.logger.log(`Password reset sent to ${to}`);
    } catch (error: any) {
      this.logger.error(`Failed to send password reset: ${error.message || error}`);
      throw error;
    }
  }

  @Process('send-payment-receipt')
  async handlePaymentReceipt(job: Job) {
    const { to, payment, order } = job.data;
    this.logger.log(`Sending payment receipt to ${to}`);
    
    try {
      await this.emailService.sendPaymentReceipt(to, payment, order);
      this.logger.log(`Payment receipt sent to ${to}`);
    } catch (error: any) {
      this.logger.error(`Failed to send payment receipt: ${error.message || error}`);
      throw error;
    }
  }
}
