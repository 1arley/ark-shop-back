import { Injectable, BadRequestException } from '@nestjs/common';
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

@Injectable()
export class MercadoPagoProvider {
  private readonly baseUrl = 'https://api.mercadopago.com';
  private readonly accessToken: string;

  constructor(private readonly configService: ConfigService) {
    this.accessToken = this.configService.get<string>('MERCADO_PAGO_ACCESS_TOKEN') || '';
    
    if (!this.accessToken) {
      console.warn('⚠️  MERCADO_PAGO_ACCESS_TOKEN not configured');
    }
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`,
    };
  }

  async createPayment(data: {
    amount: number;
    description: string;
    payerEmail?: string;
    payerName?: string;
  }): Promise<MercadoPagoPayment> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/payments`,
        {
          transaction_amount: data.amount,
          description: data.description,
          payment_method_id: 'pix',
          payer: {
            email: data.payerEmail,
            first_name: data.payerName?.split(' ')[0],
            last_name: data.payerName?.split(' ').slice(1).join(' '),
          },
        },
        {
          headers: this.getHeaders(),
        },
      );

      return {
        id: response.data.id,
        status: response.data.status,
        transaction_amount: response.data.transaction_amount,
        payer: response.data.payer,
        payment_method_id: response.data.payment_method_id,
        pix_qr_code: response.data.point_of_interaction?.qr_data,
        pix_copy_paste: response.data.point_of_interaction?.qr_code,
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Mercado Pago error: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async getPayment(paymentId: string): Promise<MercadoPagoPayment> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v1/payments/${paymentId}`,
        {
          headers: this.getHeaders(),
        },
      );

      return {
        id: response.data.id,
        status: response.data.status,
        transaction_amount: response.data.transaction_amount,
        payer: response.data.payer,
        payment_method_id: response.data.payment_method_id,
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Mercado Pago error: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async refundPayment(paymentId: string, amount?: number): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/payments/${paymentId}/refunds`,
        {
          ...(amount && { amount }),
        },
        {
          headers: this.getHeaders(),
        },
      );

      return response.data;
    } catch (error: any) {
      throw new BadRequestException(
        `Mercado Pago refund error: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async verifyPayment(paymentId: string): Promise<{
    status: string;
    amount?: number;
    providerData?: any;
  }> {
    const payment = await this.getPayment(paymentId);

    return {
      status: payment.status, // 'approved', 'rejected', 'pending'
      amount: payment.transaction_amount,
      providerData: payment,
    };
  }
}
