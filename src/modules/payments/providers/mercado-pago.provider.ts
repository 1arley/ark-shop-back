import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface MercadoPagoPayment {
  id: string;
  status: string;
  transaction_amount: number;
  payer: any;
  payment_method_id: string;
  pix_qr_code?: string;
  pix_copy_paste?: string;
}

/**
 * Mercado Pago Payment Provider
 * 
 * Official API: https://www.mercadopago.com.br/developers/pt/reference
 * Base URL: https://api.mercadopago.com
 */
@Injectable()
export class MercadoPagoProvider {
  private readonly baseUrl = 'https://api.mercadopago.com';
  private readonly accessToken: string;
  private readonly logger = new Logger(MercadoPagoProvider.name);

  constructor(private readonly configService: ConfigService) {
    this.accessToken = this.configService.get<string>('MERCADO_PAGO_ACCESS_TOKEN') || '';
    
    if (!this.accessToken || this.accessToken === 'your-mercado-pago-access-token') {
      this.logger.warn('⚠️  MERCADO_PAGO_ACCESS_TOKEN not configured properly');
    }
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
    };
  }

  /**
   * Create a PIX payment
   * 
   * @see https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/_post
   */
  async createPayment(data: {
    amount: number;
    description: string;
    payerEmail?: string;
    payerName?: string;
    payerDocument?: string;
    externalReference?: string; // Order ID
  }): Promise<MercadoPagoPayment> {
    try {
      this.logger.log(`Creating PIX payment: ${data.amount} BRL`);

      const response = await axios.post(
        `${this.baseUrl}/v1/payments`,
        {
          transaction_amount: data.amount,
          description: data.description,
          payment_method_id: 'pix',
          external_reference: data.externalReference,
          payer: {
            email: data.payerEmail,
            first_name: data.payerName?.split(' ')[0],
            last_name: data.payerName?.split(' ').slice(1).join(' '),
            identification: {
              type: 'CPF',
              number: data.payerDocument || '00000000000',
            },
          },
        },
        {
          headers: this.getHeaders(),
        },
      );

      const payment = response.data;

      this.logger.log(`Payment created: ${payment.id}, Status: ${payment.status}`);

      return {
        id: payment.id,
        status: payment.status,
        transaction_amount: payment.transaction_amount,
        payer: payment.payer,
        payment_method_id: payment.payment_method_id,
        pix_qr_code: payment.point_of_interaction?.qr_data?.qr_data,
        pix_copy_paste: payment.point_of_interaction?.qr_data?.qr_code,
      };
    } catch (error: any) {
      this.logger.error(`Mercado Pago error: ${error.response?.data?.message || error.message}`);
      
      throw new BadRequestException(
        `Failed to create payment: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Get payment details
   * 
   * @see https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_id/get
   */
  async getPayment(paymentId: string): Promise<MercadoPagoPayment> {
    try {
      this.logger.log(`Fetching payment: ${paymentId}`);

      const response = await axios.get(
        `${this.baseUrl}/v1/payments/${paymentId}`,
        {
          headers: this.getHeaders(),
        },
      );

      const payment = response.data;

      return {
        id: payment.id,
        status: payment.status,
        transaction_amount: payment.transaction_amount,
        payer: payment.payer,
        payment_method_id: payment.payment_method_id,
        pix_qr_code: payment.point_of_interaction?.qr_data?.qr_data,
        pix_copy_paste: payment.point_of_interaction?.qr_data?.qr_code,
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch payment: ${error.response?.data?.message || error.message}`);
      throw new BadRequestException(
        `Failed to fetch payment: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Refund a payment
   * 
   * @see https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_id/refunds/_post
   */
  async refundPayment(paymentId: string, amount?: number): Promise<any> {
    try {
      this.logger.log(`Refunding payment: ${paymentId}, Amount: ${amount || 'full'}`);

      const response = await axios.post(
        `${this.baseUrl}/v1/payments/${paymentId}/refunds`,
        {
          ...(amount && { amount }),
        },
        {
          headers: this.getHeaders(),
        },
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
   * Verify payment status
   * Used by webhook to confirm payment status
   */
  async verifyPayment(paymentId: string): Promise<{
    status: string;
    amount?: number;
    providerData?: any;
  }> {
    const payment = await this.getPayment(paymentId);

    this.logger.log(`Payment ${paymentId} status: ${payment.status}`);

    return {
      status: payment.status, // 'approved', 'rejected', 'pending', 'expired', 'refunded', 'cancelled'
      amount: payment.transaction_amount,
      providerData: payment,
    };
  }

  /**
   * Search payments by external_reference (order ID)
   * 
   * @see https://www.mercadopago.com.br/developers/pt/reference/payments/_payments_search/get
   */
  async searchPayments(params: {
    external_reference?: string;
    status?: string;
    sort?: string;
    begin_date?: string;
    end_date?: string;
  }): Promise<any> {
    try {
      this.logger.log(`Searching payments: ${JSON.stringify(params)}`);

      const response = await axios.get(
        `${this.baseUrl}/v1/payments/search`,
        {
          params,
          headers: this.getHeaders(),
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Search failed: ${error.response?.data?.message || error.message}`);
      throw new BadRequestException(
        `Search failed: ${error.response?.data?.message || error.message}`,
      );
    }
  }
}
