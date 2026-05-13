import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import axios from 'axios';

/**
 * Resposta de criação de cobrança PIX na Asaas
 */
export interface AsaasPixPayment {
  id: string;
  status: string;
  value: number;
  netValue: number;
  pixQrCode: string | null; // base64 PNG do QR code — usado para exibir
  pixCopyPaste: string | null; // texto copia-cola PIX — usado para pagar
  invoiceUrl: string | null;
  externalReference: string | null;
  split: Array<{ walletId: string; fixedValue: number; percentualValue: number }>;
}

/**
 * Asaas Payment Provider
 *
 * Integração com Asaas API v3 — Marketplace (Subcontas).
 *
 * Fluxo:
 *   1. Seller se cadastra → criamos uma Subconta Asaas (POST /v3/accounts)
 *   2. Armazenamos o walletId da Subconta no Seller
 *   3. Na cobrança, enviamos split: 90% seller, 10% plataforma
 *   4. Webhook confirma o pagamento e entregamos as keys
 *
 * Docs: https://docs.asaas.com/reference
 */
@Injectable()
export class AsaasProvider {
  private readonly logger = new Logger(AsaasProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('ASAAS_API_KEY') || '';
    const sandbox = this.configService.get<string>('ASAAS_SANDBOX', 'true') === 'true';
    this.baseUrl = sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3';

    if (!this.apiKey) {
      this.logger.warn('⚠️  ASAAS_API_KEY not configured. Asaas provider will fail.');
    }
  }

  // ─── Headers ─────────────────────────────────────────────────────

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      access_token: this.apiKey,
    };
  }

  // ─── Subcontas (Marketplace) ──────────────────────────────────────

  /**
   * Cria uma Subconta Asaas para o seller
   * POST /v3/accounts
   */
  async createSubAccount(data: {
    name: string;
    email: string;
    cpfCnpj: string;
    companyType?: string;
    phone?: string;
    mobilePhone?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    province?: string;
    postalCode?: string;
    bankAccount?: {
      bank: string;
      account: string;
      accountDigit: string;
      agency: string;
      agencyDigit?: string;
      type: 'CONTA_CORRENTE' | 'CONTA_POUPANCA' | 'CONTA_SALARIO';
    };
  }): Promise<{ id: string; walletId: string; accountNumber: string }> {
    try {
      this.logger.log(`Creating Asaas subaccount for: ${data.name}`);

      const response = await axios.post(`${this.baseUrl}/accounts`, data, {
        headers: this.getHeaders(),
      });

      const account = response.data;
      this.logger.log(`Subaccount created: ${account.id}`);

      return {
        id: account.id,
        walletId: account.walletId,
        accountNumber: account.accountNumber,
      };
    } catch (error: any) {
      const apiError = error.response?.data;
      this.logger.error(`Asaas create account error: ${JSON.stringify(apiError)}`);
      throw new BadRequestException(
        `Failed to create Asaas account: ${apiError?.errors?.[0]?.description || error.message}`,
      );
    }
  }

  // ─── PIX Cobrança ────────────────────────────────────────────────

  /**
   * Cria cobrança PIX com split automático
   * POST /v3/payments
   *
   * Split: 90% seller, 10% plataforma (configurável via Seller.commission)
   */
  async createPayment(data: {
    amount: number;
    description: string;
    customer: string; // Asaas customer ID
    externalReference?: string; // orderId
    payerEmail?: string;
    payerName?: string;
    payerCpf?: string;
    sellerWalletId?: string; // walletId da subconta do seller (para split)
    commissionPercent?: number; // % da plataforma (ex: 10)
  }): Promise<AsaasPixPayment> {
    try {
      this.logger.log(`Creating Asaas PIX charge: ${data.amount} BRL`);

      const commission = data.commissionPercent ?? 10;
      const sellerPercent = 100 - commission;

      const payload: any = {
        customer: data.customer,
        billingType: 'PIX',
        value: data.amount,
        dueDate: this.getDueDate(),
        description: data.description,
        externalReference: data.externalReference,
      };

      // Split automático se sellerWalletId estiver presente
      if (data.sellerWalletId) {
        payload.split = [
          {
            walletId: data.sellerWalletId,
            percentualValue: sellerPercent,
          },
          // Os restantes {commission}% ficam na conta da plataforma automaticamente
        ];
      }

      const response = await axios.post(`${this.baseUrl}/payments`, payload, {
        headers: this.getHeaders(),
      });

      const payment = response.data;
      this.logger.log(`PIX charge created: ${payment.id}, Status: ${payment.status}`);

      // Extrair QR code do PIX
      let pixQrCode: string | null = null;
      let pixCopyPaste: string | null = null;

      if (payment.pixQrCode) {
        // Asaas retorna o QR code em base64
        pixQrCode = payment.pixQrCode;
      }
      if (payment.pixCopyPaste) {
        pixCopyPaste = payment.pixCopyPaste;
      }

      // Se não veio no create, buscar os dados PIX
      if (!pixQrCode && !pixCopyPaste) {
        try {
          const pixData = await this.getPixQrCode(payment.id);
          pixQrCode = pixData.payload;
          pixCopyPaste = pixData.payload; // O payload Asaas é o copia-cola

          // Gerar QR code imagem se a Asaas não retornar
          if (!pixQrCode) {
            pixQrCode = pixData.encodedImage || null;
          }
        } catch {
          this.logger.warn(`Could not fetch PIX QR code for payment ${payment.id}`);
        }
      }

      return {
        id: payment.id,
        status: payment.status,
        value: payment.value,
        netValue: payment.netValue,
        pixQrCode: pixQrCode
          ? pixQrCode.startsWith('data:') || pixQrCode.startsWith('http')
            ? pixQrCode
            : `data:image/png;base64,${pixQrCode}`
          : null,
        pixCopyPaste: pixCopyPaste || null,
        invoiceUrl: payment.invoiceUrl || null,
        externalReference: payment.externalReference,
        split: payment.split || [],
      };
    } catch (error: any) {
      const apiError = error.response?.data;
      this.logger.error(`Asaas create payment error: ${JSON.stringify(apiError)}`);
      throw new BadRequestException(
        `Failed to create Asaas payment: ${apiError?.errors?.[0]?.description || error.message}`,
      );
    }
  }

  /**
   * Busca os dados PIX de uma cobrança
   * GET /v3/payments/{id}/pixQrCode
   */
  async getPixQrCode(paymentId: string): Promise<{
    payload: string;
    encodedImage: string | null;
    expirationDate: string | null;
  }> {
    try {
      const response = await axios.get(`${this.baseUrl}/payments/${paymentId}/pixQrCode`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to fetch PIX QR code: ${error.message}`);
      throw new BadRequestException(
        `Failed to fetch PIX QR code: ${error.response?.data?.errors?.[0]?.description || error.message}`,
      );
    }
  }

  /**
   * Verifica o status de um pagamento
   * GET /v3/payments/{id}
   */
  async verifyPayment(paymentId: string): Promise<{
    status: string;
    amount?: number;
    providerData?: any;
  }> {
    try {
      const payment = await this.getPayment(paymentId);

      const statusMap: Record<string, string> = {
        PENDING: 'pending',
        RECEIVED: 'approved',
        CONFIRMED: 'approved',
        OVERDUE: 'expired',
        REFUNDED: 'refunded',
        RECEIVED_IN_CASH: 'approved',
        REFUND_REQUESTED: 'pending',
        CHARGEBACK_REQUESTED: 'pending',
        CHARGEBACK_DISPUTE: 'pending',
        AWAITING_CHARGEBACK_REVERSAL: 'pending',
        PARTIALLY_REFUNDED: 'refunded',
        CANCELLED: 'cancelled',
      };

      return {
        status: statusMap[payment.status] || payment.status.toLowerCase(),
        amount: payment.value,
        providerData: payment,
      };
    } catch (error: any) {
      this.logger.error(`Failed to verify payment: ${error.message}`);
      throw new BadRequestException(
        `Failed to verify payment: ${error.response?.data?.errors?.[0]?.description || error.message}`,
      );
    }
  }

  /**
   * Busca dados completos do pagamento
   */
  async getPayment(paymentId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/payments/${paymentId}`, {
        headers: this.getHeaders(),
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to fetch payment: ${error.message}`);
      throw new BadRequestException(
        `Failed to fetch payment: ${error.response?.data?.errors?.[0]?.description || error.message}`,
      );
    }
  }

  /**
   * Cria um customer na Asaas (comprador)
   * POST /v3/customers
   */
  async createCustomer(data: {
    name: string;
    email: string;
    cpfCnpj?: string;
    phone?: string;
  }): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/customers`, data, {
        headers: this.getHeaders(),
      });
      return response.data.id;
    } catch (error: any) {
      const apiError = error.response?.data;
      this.logger.error(`Asaas create customer error: ${JSON.stringify(apiError)}`);
      throw new BadRequestException(
        `Failed to create Asaas customer: ${apiError?.errors?.[0]?.description || error.message}`,
      );
    }
  }

  /**
   * Reembolsa um pagamento
   * POST /v3/payments/{id}/refund
   */
  async refundPayment(paymentId: string, amount?: number): Promise<any> {
    try {
      this.logger.log(`Refunding Asaas payment: ${paymentId}`);

      const payload = amount ? { value: amount } : {};
      const response = await axios.post(`${this.baseUrl}/payments/${paymentId}/refund`, payload, {
        headers: this.getHeaders(),
      });

      this.logger.log(`Refund successful: ${response.data.id}`);
      return response.data;
    } catch (error: any) {
      const apiError = error.response?.data;
      this.logger.error(`Asaas refund error: ${JSON.stringify(apiError)}`);
      throw new BadRequestException(
        `Refund failed: ${apiError?.errors?.[0]?.description || error.message}`,
      );
    }
  }

  // ─── Utilitários ─────────────────────────────────────────────────

  /**
   * Busca o seller pelo userId para obter os dados de split
   */
  async getSellerWalletForOrder(orderId: string): Promise<{
    walletId: string | null;
    commission: number;
  } | null> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!order) return null;

      // Pega o primeiro produto do pedido para identificar o seller
      // Nota: em um marketplace real, cada item pode ter um seller diferente
      const firstItem = order.items[0];
      if (!firstItem) return null;

      // Busca o seller associado ao produto (ou ao user)
      // No modelo atual, produtos não têm seller_id — assumimos que o seller
      // é o dono da loja. TODO: adicionar sellerId ao Product
      const seller = await this.prisma.seller.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!seller?.asaasWalletId) return null;

      return {
        walletId: seller.asaasWalletId,
        commission: seller.commission.toNumber(),
      };
    } catch (error: unknown) {
      this.logger.error(`Failed to get seller wallet for order ${orderId}: ${String(error)}`);
      return null;
    }
  }

  private getDueDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 3); // Vencimento em 3 dias
    return date.toISOString().substring(0, 10);
  }
}
