import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Order, OrderItem, Product, Payment } from '@prisma/client';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
  private readonly resend: Resend;
  private readonly logger = new Logger(EmailService.name);
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('RESEND_API_KEY');
    const emailFrom = this.configService.get<string>('EMAIL_FROM');
    this.from = emailFrom ?? "D'Ark Games Store <onboarding@resend.dev>";

    this.resend = new Resend(apiKey);
    this.logger.log('Resend email service initialized.');
  }

  async send(options: EmailOptions): Promise<boolean> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });

      if (error) {
        this.logger.error(`Failed to send email: ${error.message}`);
        this.logFallback(options, error.message);
        return false;
      }

      this.logger.log(`Email sent: ${data?.id}`);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send email: ${message}`);
      this.logFallback(options, message);
      return false;
    }
  }

  /**
   * Logs email content to console as fallback when Resend fails (e.g. sandbox mode).
   * Useful for development without a verified domain.
   */
  private logFallback(options: EmailOptions, reason: string) {
    this.logger.warn(
      `\n📧 EMAIL FALLBACK (Resend failed: ${reason})\n` +
        `  To: ${options.to}\n` +
        `  Subject: ${options.subject}\n` +
        `  Text: ${options.text || '(see html)'}\n` +
        `  ─────────────────────────────────`,
    );
  }

  async sendOrderConfirmation(
    to: string,
    order: OrderWithRelations,
    items: OrderItemWithProduct[],
  ): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
         <h1 style="color: #333;">Confirmação de Pedido</h1>
        <p>Obrigado pelo seu pedido!</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2>Pedido #${order.id}</h2>
          <p><strong>Data:</strong> ${new Date(order.createdAt).toLocaleDateString('pt-BR')}</p>
          <p><strong>Total:</strong> R$ ${Number(order.total).toFixed(2)}</p>
          <p><strong>Status:</strong> ${order.status}</p>
        </div>

        <h3>Itens do Pedido:</h3>
        <ul>
          ${items
            .map(
              item => `
            <li>
              ${item.product.name} x ${item.quantity} - R$ ${Number(item.price).toFixed(2)}
            </li>
          `,
            )
            .join('')}
        </ul>

        <p style="margin-top: 30px;">
          Voce pode ver os detalhes do seu pedido e baixar suas chaves assim que forem entregues.
        </p>

        <p>Obrigado por comprar na D'Ark Games Store!</p>
      </div>
    `;

    const text = `
Confirmação de Pedido

Pedido #: ${order.id}
Data: ${new Date(order.createdAt).toLocaleDateString('pt-BR')}
Total: R$ ${Number(order.total).toFixed(2)}
Status: ${order.status}

Itens:
${items.map(item => `- ${item.product.name} x ${item.quantity} - R$ ${Number(item.price).toFixed(2)}`).join('\n')}

Obrigado por comprar na D'Ark Games Store!
    `;

    return this.send({
      to,
      subject: `Confirmacao de Pedido #${order.id}`,
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
        <h1 style="color: #27ae60;">Suas Chaves Estao Prontas!</h1>
        <p>Obrigado pela sua compra. Suas chaves digitais estao prontas para uso.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2>Pedido #${order.id}</h2>
          <p><strong>Data:</strong> ${new Date(order.createdAt).toLocaleDateString('pt-BR')}</p>
        </div>

        <h3>Suas Chaves:</h3>
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
          <strong>Importante:</strong> Guarde suas chaves com seguranca! Uma vez reveladas, as chaves nao podem ser substituidas.
        </p>

        <p>Aproveite seus jogos!</p>
      </div>
    `;

    const text = `
Suas Chaves Estao Prontas!

Pedido #: ${order.id}
Data: ${new Date(order.createdAt).toLocaleDateString('pt-BR')}

Suas Chaves:
${keys.map(k => `${k.productName}: ${k.key}`).join('\n')}

Importante: Guarde suas chaves com seguranca! Uma vez reveladas, as chaves nao podem ser substituidas.

Aproveite seus jogos!
    `;

    return this.send({
      to,
      subject: `Suas Chaves Digitais - Pedido #${order.id}`,
      html,
      text,
    });
  }

  async sendPasswordReset(to: string, resetToken: string, email: string): Promise<boolean> {
    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3498db;">Redefinicao de Senha</h1>
        <p>Voce solicitou a redefinicao de senha da sua conta D'Ark Games Store.</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Redefinir Senha
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          Este link expira em 1 hora. Se voce nao solicitou esta redefinicao, ignore este email.
        </p>

        <p style="margin-top: 30px;">
          Ou copie e cole esta URL:<br>
          <code style="background: #f0f0f0; padding: 5px; word-break: break-all;">${resetUrl}</code>
        </p>
      </div>
    `;

    const text = `
Redefinicao de Senha

Voce solicitou a redefinicao de senha da sua conta D'Ark Games Store.

URL de redefinicao: ${resetUrl}

Este link expira em 1 hora. Se voce nao solicitou esta redefinicao, ignore este email.
    `;

    return this.send({
      to,
      subject: "Redefinicao de Senha - D'Ark Games Store",
      html,
      text,
    });
  }

  async sendEmailVerification(
    to: string,
    verificationCode: string,
    email: string,
  ): Promise<boolean> {
    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    const verificationUrl = `${frontendUrl}/verify-email?code=${verificationCode}&email=${encodeURIComponent(email)}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #27ae60;">Verifique seu Email</h1>
        <p>Bem-vindo a D'Ark Games Store! Para concluir seu cadastro, verifique seu email.</p>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Seu codigo de verificacao:</p>
          <p style="font-size: 32px; font-weight: bold; color: #27ae60; letter-spacing: 8px; margin: 0;">${verificationCode}</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Verificar Email
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          Este codigo expira em 24 horas. Se voce nao criou uma conta, ignore este email.
        </p>
      </div>
    `;

    const text = `
Verifique seu Email

Bem-vindo a D'Ark Games Store! Para concluir seu cadastro, verifique seu email.

Seu codigo de verificacao: ${verificationCode}

Ou acesse: ${verificationUrl}

Este codigo expira em 24 horas. Se voce nao criou uma conta, ignore este email.
    `;

    return this.send({
      to,
      subject: "Verifique seu Email - D'Ark Games Store",
      html,
      text,
    });
  }

  async sendPasswordResetWithCode(to: string, resetCode: string, _email: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #e74c3c;">Redefinicao de Senha</h1>
        <p>Voce solicitou a redefinicao de senha da sua conta D'Ark Games Store.</p>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Seu codigo de redefinicao:</p>
          <p style="font-size: 32px; font-weight: bold; color: #e74c3c; letter-spacing: 8px; margin: 0;">${resetCode}</p>
        </div>

        <p style="color: #666; font-size: 14px;">
          Use este codigo na pagina de redefinicao de senha. Ele expira em 10 minutos.
          Se voce nao solicitou esta redefinicao, ignore este email.
        </p>
      </div>
    `;

    const text = `
Redefinicao de Senha

Voce solicitou a redefinicao de senha da sua conta D'Ark Games Store.

Seu codigo de redefinicao: ${resetCode}

Use este codigo na pagina de redefinicao de senha. Ele expira em 10 minutos.
Se voce nao solicitou esta redefinicao, ignore este email.
    `;

    return this.send({
      to,
      subject: "Codigo de Redefinicao de Senha - D'Ark Games Store",
      html,
      text,
    });
  }

  async sendEmailChangeConfirmation(to: string, code: string, name: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #e67e22;">Confirmacao de Alteracao de Email</h1>
        <p>Ola ${name},</p>
        <p>Voce solicitou a alteracao do seu email na D'Ark Games Store.</p>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center;">
          <p style="font-size: 14px; color: #666; margin-bottom: 10px;">Seu codigo de confirmacao:</p>
          <p style="font-size: 32px; font-weight: bold; color: #e67e22; letter-spacing: 8px; margin: 0;">${code}</p>
        </div>

        <p style="color: #666; font-size: 14px;">
          Use este codigo para confirmar a alteracao do seu email.
          Este codigo expira em 10 minutos.
        </p>

        <p style="color: #999; font-size: 12px;">
          Se voce nao solicitou esta alteracao, ignore este email.
          Sua conta permanecera segura com o email atual.
        </p>
      </div>
    `;

    const text = `
Confirmacao de Alteracao de Email

Ola ${name},
Voce solicitou a alteracao do seu email na D'Ark Games Store.

Seu codigo de confirmacao: ${code}

Use este codigo para confirmar a alteracao do seu email.
Este codigo expira em 10 minutos.

Se voce nao solicitou esta alteracao, ignore este email.
Sua conta permanecera segura com o email atual.
    `;

    return this.send({
      to,
      subject: "Confirmacao de Alteracao de Email - D'Ark Games Store",
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
        <h1 style="color: #2ecc71;">Recibo de Pagamento</h1>
        <p>Seu pagamento foi processado com sucesso.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2>Detalhes do Pagamento</h2>
          <p><strong>ID da Transacao:</strong> ${payment.id}</p>
          <p><strong>Valor:</strong> R$ ${Number(payment.amount).toFixed(2)}</p>
          <p><strong>Data:</strong> ${new Date(payment.createdAt).toLocaleDateString('pt-BR')}</p>
          <p><strong>Metodo:</strong> ${payment.method}</p>
          <p><strong>Status:</strong> ${payment.status}</p>
        </div>

        <p>Pedido #${order.id} foi confirmado e sera processado em breve.</p>

        <p>Obrigado pela sua compra!</p>
      </div>
    `;

    const text = `
Recibo de Pagamento

ID da Transacao: ${payment.id}
Valor: R$ ${Number(payment.amount).toFixed(2)}
Data: ${new Date(payment.createdAt).toLocaleDateString('pt-BR')}
Metodo: ${payment.method}
Status: ${payment.status}

Pedido #${order.id} foi confirmado.

Obrigado pela sua compra!
    `;

    return this.send({
      to,
      subject: `Recibo de Pagamento - R$ ${Number(payment.amount).toFixed(2)}`,
      html,
      text,
    });
  }
}
