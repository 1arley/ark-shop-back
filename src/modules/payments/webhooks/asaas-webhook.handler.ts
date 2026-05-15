import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PaymentsService } from '../payments.service';

/**
 * Resultado da autorização de saque/estorno para o Asaas
 */
export interface AsaasWebhookResult {
  /** Status processado internamente */
  processed: boolean;
  /**
   * Decisão para eventos de autorização (WITHDRAWAL_REQUESTED etc.)
   * Enviado no body da resposta para o Asaas.
   */
  authorizationStatus?: 'APPROVED' | 'REJECTED';
}

/**
 * Asaas Webhook Handler
 *
 * Processa notificações de pagamento e autorização de saques/estornos.
 * Docs: https://docs.asaas.com/reference/webhook-notifications
 *
 * Eventos de pagamento:
 *   - PAYMENT_RECEIVED       → aprova e entrega keys
 *   - PAYMENT_CONFIRMED      → confirmação adicional
 *   - PAYMENT_REFUNDED       → estorno de pagamento
 *
 * Eventos de autorização (resposta síncrona obrigatória):
 *   - WITHDRAWAL_REQUESTED   → Asaas pede autorização para estorno/saque
 *     A resposta no body define se é APPROVED ou REJECTED
 */
@Injectable()
export class AsaasWebhookHandler {
  private readonly logger = new Logger(AsaasWebhookHandler.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get<string>('ASAAS_WEBHOOK_SECRET') || '';
  }

  /**
   * Verifica a assinatura do webhook
   * Asaas envia header x-webhook-signature com HMAC-SHA256 do body
   */
  verifySignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature) {
      this.logger.warn('Asaas webhook signature missing');
      return false;
    }

    if (!this.webhookSecret) {
      this.logger.error('ASAAS_WEBHOOK_SECRET is not set. All webhooks rejected.');
      return false;
    }

    try {
      const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);

      const expectedSignature = createHmac('sha256', this.webhookSecret)
        .update(bodyBuffer)
        .digest();

      const normalizedSig = signature.toLowerCase();
      const signatureBuffer = Buffer.from(normalizedSig, 'hex');
      const expectedBuffer = expectedSignature;

      if (signatureBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch (error) {
      this.logger.error('Asaas webhook signature verification failed', error);
      return false;
    }
  }

  /**
   * Processa evento do webhook Asaas
   *
   * Importante: eventos de autorização (WITHDRAWAL_REQUESTED) exigem
   * resposta SÍNCRONA. O controller deve retornar o authorizationStatus
   * no body da resposta HTTP.
   *
   * @returns Resultado com a decisão de autorização (se aplicável)
   */
  async handleEvent(event: {
    event: string;
    payment?: any;
    subscription?: any;
    invoice?: any;
    transfer?: any;
    withdrawal?: any;
  }): Promise<AsaasWebhookResult> {
    if (!event || !event.event) {
      this.logger.warn('Invalid Asaas webhook payload');
      return { processed: false };
    }

    this.logger.log(`Processing Asaas webhook event: ${event.event}`);

    try {
      switch (event.event) {
        // ─── Pagamentos ─────────────────────────────────────────
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
          await this.handlePaymentReceived(event.payment);
          return { processed: true };

        case 'PAYMENT_REFUNDED':
        case 'PAYMENT_REFUND_REQUESTED':
          await this.handlePaymentRefunded(event.payment);
          return { processed: true };

        case 'PAYMENT_OVERDUE':
          this.logger.log(`Payment overdue: ${event.payment?.id}`);
          return { processed: true };

        case 'PAYMENT_CANCELLED':
          await this.handlePaymentCancelled(event.payment);
          return { processed: true };

        // ─── Autorização de Saques/Estornos ─────────────────────
        // Ativado por você no painel Asaas:
        // "Ativar autorização de saque para estornos Pix"
        //
        // Quando um PIX é estornado (chargeback), o Asaas precisa
        // reter o valor da subconta do vendedor. Ele nos pergunta
        // se pode. Respondemos APPROVED para que o vendedor assuma
        // o prejuízo, não a plataforma.
        case 'WITHDRAWAL_REQUESTED':
        case 'PAYMENT_CHECKOUT_REFUND_REQUEST':
          return this.handleWithdrawalAuthorization(event);

        default:
          this.logger.debug(`Unhandled Asaas event type: ${event.event}`);
          return { processed: false };
      }
    } catch (error: any) {
      this.logger.error(`Failed to process Asaas webhook event: ${event.event}`, error);
      // Em caso de erro interno, negamos a autorização por segurança
      return { processed: false, authorizationStatus: 'REJECTED' };
    }
  }

  // ─── Handlers de Pagamento ──────────────────────────────────────

  private async handlePaymentReceived(payment: any) {
    if (!payment?.id) {
      this.logger.warn('Payment ID missing in webhook data');
      throw new Error('Payment ID missing');
    }

    const providerPaymentId = String(payment.id);
    this.logger.log(`Payment received: ${providerPaymentId}`);

    await this.paymentsService.approvePaymentByProviderTxId(providerPaymentId, payment);
  }

  private async handlePaymentRefunded(payment: any) {
    if (!payment?.id) return;

    const providerPaymentId = String(payment.id);
    this.logger.log(`Payment refunded: ${providerPaymentId}`);

    // Deixa o erro propagar — o handleEvent retorna authorizationStatus: 'REJECTED'
    // e o Asaas retenta o webhook automaticamente
    await this.paymentsService.refundPaymentByProviderTxId(providerPaymentId);
  }

  private async handlePaymentCancelled(payment: any) {
    if (!payment?.id) return;

    const providerPaymentId = String(payment.id);
    this.logger.log(`Payment cancelled: ${providerPaymentId}`);

    await this.paymentsService.rejectPaymentByProviderTxId(providerPaymentId, 'cancelled');
  }

  // ─── Autorização de Saques/Estornos ─────────────────────────────

  /**
   * Processa pedido de autorização de saque/estorno do Asaas.
   *
   * Regras de decisão:
   *   1. Estorno de PIX (chargeback) → APPROVED
   *      O dinheiro volta do vendedor, não da plataforma.
   *   2. Saque/Transferência normal → APPROVED
   *      Confiamos no seller. Pode ser rejeitado futuramente
   *      se houver suspeita de fraude.
   *   3. Erro interno → REJECTED (segurança: nega se não sabe)
   *
   * @returns Decisão de autorização para o Asaas
   */
  private handleWithdrawalAuthorization(event: {
    event?: string;
    payment?: any;
    withdrawal?: any;
    transfer?: any;
  }): AsaasWebhookResult {
    const eventType = event.event || 'WITHDRAWAL_REQUESTED';
    const withdrawal = event.withdrawal || event.transfer || event.payment;

    if (!withdrawal) {
      this.logger.warn('Withdrawal authorization: missing withdrawal data');
      return { processed: true, authorizationStatus: 'REJECTED' };
    }

    const withdrawalId = withdrawal.id || 'unknown';
    const value = withdrawal.value || withdrawal.amount || 0;
    const type = withdrawal.type || withdrawal.description || 'unknown';

    this.logger.log(
      `Withdrawal authorization requested: ID=${withdrawalId}, ` + `Value=R$${value}, Type=${type}`,
    );

    // Decide se aprova ou rejeita com base no tipo
    const isPixRefund =
      type?.toString().toUpperCase().includes('PIX') ||
      type?.toString().toUpperCase().includes('REFUND') ||
      type?.toString().toUpperCase().includes('CHARGEBACK') ||
      type?.toString().toUpperCase().includes('ESTORNO') ||
      eventType === 'PAYMENT_CHECKOUT_REFUND_REQUEST';

    // FUTURO: aqui você pode adicionar regras de negócio:
    // - Verificar saldo do seller
    // - Verificar se seller está ativo
    // - Verificar histórico de chargebacks
    // - Bloquear sellers suspeitos

    if (isPixRefund) {
      this.logger.log(
        `✅ PIX refund authorized for withdrawal ${withdrawalId}: ` +
          `seller bears the loss of R$${value}`,
      );
    } else {
      this.logger.log(`✅ Withdrawal authorized: ${withdrawalId} = R$${value}`);
    }

    return { processed: true, authorizationStatus: 'APPROVED' };
  }
}
