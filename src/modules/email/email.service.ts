import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Order, OrderItem, Product, Payment } from '@prisma/client';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
}

interface OrderWithRelations extends Order {
  user: { id: string; email: string; name: string | null };
  items: Array<OrderItem & { product: Product }>;
  payment: Payment | null;
}

interface OrderItemWithProduct {
  product: { name: string };
  quantity: number;
  price: number;
}

@Injectable()
export class EmailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);
  private readonly from: string;
  private isReady = false;

  constructor(private readonly configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<string>('SMTP_PORT');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');
    const emailFrom = this.configService.get<string>('EMAIL_FROM');
    this.from = emailFrom ?? "D'Ark Games Store <noreply@darkgames.com>";

    // Configure transporter
    this.transporter = nodemailer.createTransport({
      host: smtpHost ?? 'smtp.mailtrap.io', // Default to Mailtrap for testing
      port: smtpPort ? parseInt(smtpPort) : 2525,
      secure: false,
      auth: smtpHost
        ? {
            user: smtpUser,
            pass: smtpPass,
          }
        : undefined,
    });

    // Verify connection configuration
    this.transporter.verify(error => {
      if (error) {
        this.logger.error(`Email transporter unhealthy: ${error.message}`);
        this.isReady = false;
      } else {
        this.logger.log('Email service ready.');
        this.isReady = true;
      }
    });
  }

  async send(options: EmailOptions): Promise<boolean> {
    if (!this.isReady) {
      this.logger.warn('Email not sent — transporter not ready.');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });

      this.logger.log(`Email sent: ${info.messageId}`);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send email: ${message}`);
      throw error;
    }
  }

  async sendOrderConfirmation(
    to: string,
    order: OrderWithRelations,
    items: OrderItemWithProduct[],
  ): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #333;">Order Confirmation</h1>
        <p>Thank you for your order!</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2>Order #${order.id}</h2>
          <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
          <p><strong>Status:</strong> ${order.status}</p>
        </div>

        <h3>Order Items:</h3>
        <ul>
          ${items
            .map(
              item => `
            <li>
              ${item.product.name} x ${item.quantity} - $${item.price.toFixed(2)}
            </li>
          `,
            )
            .join('')}
        </ul>

        <p style="margin-top: 30px;">
          You can view your order details and download your keys once delivered.
        </p>

        <p>Thank you for shopping with D'Ark Games Store!</p>
      </div>
    `;

    const text = `
Order Confirmation

Order #: ${order.id}
Date: ${new Date(order.createdAt).toLocaleDateString()}
Total: $${order.total.toFixed(2)}
Status: ${order.status}

Items:
${items.map(item => `- ${item.product.name} x ${item.quantity} - $${item.price.toFixed(2)}`).join('\n')}

Thank you for shopping with D'Ark Games Store!
    `;

    return this.send({
      to,
      subject: `Order Confirmation #${order.id}`,
      html,
      text,
    });
  }

  async sendKeyDelivery(
    to: string,
    order: OrderWithRelations,
    keys: Array<{ productName: string; key: string }>,
  ): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #27ae60;">Your Keys Are Ready!</h1>
        <p>Thank you for your purchase. Your digital keys are ready to use.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2>Order #${order.id}</h2>
          <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
        </div>

        <h3>Your Keys:</h3>
        <div style="background: #fff; border: 1px solid #ddd; border-radius: 5px; padding: 15px;">
          ${keys
            .map(
              k => `
            <div style="margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
              <strong>${k.productName}</strong><br>
              <code style="background: #f0f0f0; padding: 5px 10px; display: inline-block; margin-top: 5px;">${k.key}</code>
            </div>
          `,
            )
            .join('')}
        </div>

        <p style="margin-top: 20px; color: #e74c3c;">
          <strong>Important:</strong> Keep your keys safe! Once revealed, keys cannot be replaced.
        </p>

        <p>Enjoy your games!</p>
      </div>
    `;

    const text = `
Your Keys Are Ready!

Order #: ${order.id}
Date: ${new Date(order.createdAt).toLocaleDateString()}

Your Keys:
${keys.map(k => `${k.productName}: ${k.key}`).join('\n')}

Important: Keep your keys safe! Once revealed, keys cannot be replaced.

Enjoy your games!
    `;

    return this.send({
      to,
      subject: `Your Digital Keys - Order #${order.id}`,
      html,
      text,
    });
  }

  async sendPasswordReset(to: string, resetToken: string, email: string): Promise<boolean> {
    const resetUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3498db;">Password Reset Request</h1>
        <p>You requested a password reset for your D'Ark Games Store account.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Reset Password
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
        </p>

        <p style="margin-top: 30px;">
          Or copy and paste this URL:<br>
          <code style="background: #f0f0f0; padding: 5px; word-break: break-all;">${resetUrl}</code>
        </p>
      </div>
    `;

    const text = `
Password Reset Request

You requested a password reset for your D'Ark Games Store account.

Reset URL: ${resetUrl}

This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
    `;

    return this.send({
      to,
      subject: 'Password Reset Request',
      html,
      text,
    });
  }

  async sendPaymentReceipt(
    to: string,
    payment: Payment & { order?: Order },
    order: Order & { items?: OrderItem[] },
  ): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2ecc71;">Payment Receipt</h1>
        <p>Your payment has been processed successfully.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2>Payment Details</h2>
          <p><strong>Transaction ID:</strong> ${payment.id}</p>
          <p><strong>Amount:</strong> $${payment.amount.toFixed(2)}</p>
          <p><strong>Date:</strong> ${new Date(payment.createdAt).toLocaleDateString()}</p>
          <p><strong>Method:</strong> ${payment.method}</p>
          <p><strong>Status:</strong> ${payment.status}</p>
        </div>

        <p>Order #${order.id} has been confirmed and will be processed shortly.</p>

        <p>Thank you for your purchase!</p>
      </div>
    `;

    const text = `
Payment Receipt

Transaction ID: ${payment.id}
Amount: $${payment.amount.toFixed(2)}
Date: ${new Date(payment.createdAt).toLocaleDateString()}
Method: ${payment.method}
Status: ${payment.status}

Order #${order.id} has been confirmed.

Thank you for your purchase!
    `;

    return this.send({
      to,
      subject: `Payment Receipt - ${payment.amount.toFixed(2)}`,
      html,
      text,
    });
  }
}
