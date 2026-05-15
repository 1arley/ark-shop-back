import { Injectable, Logger } from '@nestjs/common';
import { ContactDto } from './dto/contact.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService } from '@/modules/email/email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Escapa caracteres HTML para prevenir XSS em emails.
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async send(dto: ContactDto) {
    this.logger.log(`Contact message received from ${dto.email}: "${dto.subject}"`);

    const safeName = this.escapeHtml(dto.name);
    const safeEmail = this.escapeHtml(dto.email);
    const safeSubject = this.escapeHtml(dto.subject);
    const safeMessage = this.escapeHtml(dto.message);

    // 1. Notify all ADMIN and SUPERADMIN users
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPERADMIN'] } },
      select: { id: true, email: true, name: true },
    });

    // 2. Create notification records for all admins
    if (admins.length > 0) {
      await this.prisma.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          type: 'EMAIL' as const,
          status: 'PENDING' as const,
          subject: `Novo contato: ${safeSubject}`,
          content: `De: ${safeName} (${safeEmail})\n\n${safeMessage}`,
          metadata: {
            senderName: dto.name,
            senderEmail: dto.email,
            subject: dto.subject,
          },
        })),
      });
    }

    // 3. Send email notification to configured admin email
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    if (adminEmail) {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Novo Contato - D'Ark Games Store</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; font-weight: bold;">Nome:</td><td>${safeName}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td>${safeEmail}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Assunto:</td><td>${safeSubject}</td></tr>
          </table>
          <hr style="margin: 20px 0;" />
          <p style="white-space: pre-wrap;">${safeMessage}</p>
        </div>
      `;

      this.emailService
        .send({
          to: adminEmail,
          subject: `[Contato] ${safeSubject}`,
          html,
        })
        .catch((err: Error) => {
          this.logger.error(`Failed to send contact notification email: ${err.message}`);
        });
    }

    return {
      message: 'Mensagem enviada com sucesso. Entraremos em contato em breve.',
    };
  }
}
