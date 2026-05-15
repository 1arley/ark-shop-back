import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface MercadoPagoPayment {
  id: string;
  status: string;
  transaction_amount: number;
  payer: any;
  payment_method_id: string;
  pix_qr_code?: string;
  pix_copy_paste?: string;
  ticket_url?: string;
}

/**
 * Mercado Pago Payment Provider
 *
 * Uses the Orders API (v1/orders) — newer standard with better PIX support.
 * Docs: https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api/create-order/post
 */
@Injectable()
export class MercadoPagoProvider {
  private readonly baseUrl = 'https://api.mercadopago.com';
  private readonly accessToken: string;
  private readonly isSandbox: boolean;
  private readonly logger = new Logger(MercadoPagoProvider.name);

  constructor(private readonly configService: ConfigService) {
    this.accessToken = this.configService.get<string>('MERCADO_PAGO_ACCESS_TOKEN') || '';
    this.isSandbox = this.accessToken.startsWith('TEST-');

    if (!this.accessToken) {
      this.logger.warn('⚠️  MERCADO_PAGO_ACCESS_TOKEN not configured');
    }
  }

  private getPayerEmail(email?: string): string | undefined {
    // Sandbox requires @testuser.com emails
    if (this.isSandbox) {
      const testEmail = this.configService.get<string>('MERCADO_PAGO_TEST_EMAIL');
      if (testEmail) return testEmail;
      // Fallback: use a generic test user email
      this.logger.warn(
        'Sandbox mode: using default test user email. Set MERCADO_PAGO_TEST_EMAIL for a specific one.',
      );
      return 'test_user_123456789@testuser.com';
    }
    return email;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  /**
   * Create a PIX payment via Orders API
   *
   * POST /v1/orders
   * @see https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api/create-order/post
   */
  async createPayment(data: {
    amount: number;
    description: string;
    payerEmail?: string;
    payerName?: string;
    payerDocument?: string;
    payerBirthDate?: string;
    externalReference?: string;
  }): Promise<MercadoPagoPayment> {
    try {
      this.logger.log(`Creating PIX order: ${data.amount} BRL`);

      const idempotencyKey = uuidv4();
      const amountStr = data.amount.toFixed(2);

      const response = await axios.post(
        `${this.baseUrl}/v1/orders`,
        {
          type: 'online',
          total_amount: amountStr,
          external_reference: data.externalReference,
          processing_mode: 'automatic',
          transactions: {
            payments: [
              {
                amount: amountStr,
                payment_method: {
                  id: 'pix',
                  type: 'bank_transfer',
                },
              },
            ],
          },
          payer: {
            email: this.getPayerEmail(data.payerEmail),
          },
        },
        {
          headers: {
            ...this.getHeaders(),
            'X-Idempotency-Key': idempotencyKey,
          },
        },
      );

      const order = response.data;
      const payment = order.transactions?.payments?.[0] || {};

      this.logger.log(`Order created: ${order.id}, Status: ${order.status}`);

      return {
        id: order.id,
        status: order.status,
        transaction_amount: data.amount,
        payer: order.payer,
        payment_method_id: 'pix',
        pix_qr_code: payment.payment_method?.qr_code_base64, // base64 image → DB pixQrCode
        pix_copy_paste: payment.payment_method?.qr_code, // PIX text → DB pixCode
        ticket_url: payment.payment_method?.ticket_url,
      };
    } catch (error: any) {
      const mpError = error.response?.data;
      this.logger.error(
        `Mercado Pago error: ${mpError?.message || mpError?.error || error.message}`,
      );

      throw new BadRequestException(
        `Failed to create payment: ${mpError?.message || error.message}`,
      );
    }
  }

  /**
   * Get order details
   * GET /v1/orders/{id}
   */
  async getOrder(orderId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/orders/${orderId}`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to fetch order: ${error.response?.data?.message || error.message}`);
      throw new BadRequestException(
        `Failed to fetch order: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Get payment details (falls back to Payments API for status checks)
   */
  async getPayment(paymentId: string): Promise<MercadoPagoPayment> {
    try {
      // Orders API returns order; extract payment status from it
      const order = await this.getOrder(paymentId);
      const payment = order.transactions?.payments?.[0] || {};

      return {
        id: payment.id || order.id,
        status:
          order.status === 'processed'
            ? 'approved'
            : order.status === 'cancelled'
              ? 'cancelled'
              : order.status,
        transaction_amount: parseFloat(order.total_amount || '0'),
        payer: order.payer,
        payment_method_id: 'pix',
        pix_qr_code: payment.payment_method?.qr_code_base64,
        pix_copy_paste: payment.payment_method?.qr_code,
        ticket_url: payment.payment_method?.ticket_url,
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch payment: ${error.message}`);
      throw new BadRequestException(`Failed to fetch payment: ${error.message}`);
    }
  }

  /**
   * Refund a payment via Orders API
   * POST /v1/orders/{order_id}/refund
   */
  async refundPayment(paymentId: string, amount?: number): Promise<any> {
    try {
      this.logger.log(`Refunding order: ${paymentId}, Amount: ${amount || 'full'}`);

      const response = await axios.post(
        `${this.baseUrl}/v1/orders/${paymentId}/refund`,
        {},
        { headers: this.getHeaders() },
      );

      this.logger.log(`Refund successful: ${response.data.id}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Refund failed: ${error.response?.data?.message || error.message}`);
      throw new BadRequestException(
        `Refund failed: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Verify payment status via Orders API
   */
  async verifyPayment(paymentId: string): Promise<{
    status: string;
    amount?: number;
    providerData?: any;
  }> {
    const order = await this.getOrder(paymentId);

    const statusMap: Record<string, string> = {
      created: 'pending',
      processed: 'approved',
      action_required: 'pending',
      cancelled: 'cancelled',
      expired: 'expired',
      refunded: 'refunded',
    };

    return {
      status: statusMap[order.status] || order.status,
      amount: parseFloat(order.total_amount || '0'),
      providerData: order,
    };
  }

  /**
   * Search orders by external_reference
   * GET /v1/orders/search
   */
  async searchPayments(params: {
    external_reference?: string;
    status?: string;
    sort?: string;
    begin_date?: string;
    end_date?: string;
  }): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/v1/orders/search`, {
        params,
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.response?.data?.message || error.message}`);
      throw new BadRequestException(
        `Search failed: ${error.response?.data?.message || error.message}`,
      );
    }
  }
}
