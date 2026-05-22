import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService } from '@/modules/email/email.service';
import { AuthTokenService } from '@/auth/auth-token.service';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { ResetPasswordWithCodeDto } from '@/auth/dto/reset-password-code.dto';
import {
  DEFAULT_BCRYPT_SALT_ROUNDS,
  PASSWORD_RESET_EXPIRY_HOURS,
  HOUR_IN_MS,
  PASSWORD_RESET_CODE_LENGTH,
  PASSWORD_RESET_CODE_EXPIRY_MINUTES,
  MINUTE_IN_MS,
} from '@/common/constants';
import type { MessageResult } from '@/auth/interfaces/auth-results.interface';

/**
 * AuthPasswordService
 *
 * Single responsibility: forgot password and reset password flows
 * (both token-based and OTP-code-based).
 */
@Injectable()
export class AuthPasswordService {
  private readonly logger = new Logger(AuthPasswordService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async forgotPassword(email: string): Promise<MessageResult> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { message: 'Se o email existir, um link de redefinicao sera enviado.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetExpiryHours = parseInt(
      this.configService.get<string>('PASSWORD_RESET_EXPIRY_HOURS') ||
        String(PASSWORD_RESET_EXPIRY_HOURS),
      10,
    );
    const expiresAt = new Date(Date.now() + resetExpiryHours * HOUR_IN_MS);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt,
      },
    });

    // Send password reset email (non-blocking — token already created)
    this.emailService.sendPasswordReset(email, token, email).catch(err => {
      this.logger.error(
        `Failed to send password reset email to ${email}: ${err instanceof Error ? err.message : err}`,
      );
    });

    return { message: 'Se o email existir, um link de redefinicao sera enviado.' };
  }

  async forgotPasswordWithCode(email: string): Promise<MessageResult> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { message: 'Se o email existir, um codigo de redefinicao sera enviado.' };
    }

    const resetCode = this.generateNumericCode(PASSWORD_RESET_CODE_LENGTH);
    const codeHash = crypto.createHash('sha256').update(resetCode).digest('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_EXPIRY_MINUTES * MINUTE_IN_MS);

    // Invalidate previous unused codes
    await this.prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: codeHash,
        expiresAt,
      },
    });

    // Send password reset code email (non-blocking — code already created)
    this.emailService.sendPasswordResetWithCode(email, resetCode, email).catch(err => {
      this.logger.error(
        `Failed to send password reset code email to ${email}: ${err instanceof Error ? err.message : err}`,
      );
    });

    return { message: 'Se o email existir, um codigo de redefinicao sera enviado.' };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResult> {
    const { token, email, password } = dto;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Token invalido ou expirado.');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        token: tokenHash,
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Token invalido ou expirado.');
    }

    const saltRounds = parseInt(
      this.configService.get<string>('BCRYPT_SALT_ROUNDS') || String(DEFAULT_BCRYPT_SALT_ROUNDS),
    );
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
    ]);

    // Revoke all refresh tokens after password reset
    await this.authTokenService.revokeAllUserRefreshTokens(user.id);

    return { message: 'Senha redefinida com sucesso.' };
  }

  async resetPasswordWithCode(dto: ResetPasswordWithCodeDto): Promise<MessageResult> {
    const { code, email, password } = dto;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Codigo invalido ou expirado.');
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const resetToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        token: codeHash,
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!resetToken) {
      throw new BadRequestException('Codigo invalido ou expirado.');
    }

    const saltRounds = parseInt(
      this.configService.get<string>('BCRYPT_SALT_ROUNDS') || String(DEFAULT_BCRYPT_SALT_ROUNDS),
    );
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
    ]);

    // Revoke all refresh tokens after password reset
    await this.authTokenService.revokeAllUserRefreshTokens(user.id);

    return { message: 'Senha redefinida com sucesso.' };
  }

  private generateNumericCode(length: number): string {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += crypto.randomInt(0, 10).toString();
    }
    return code;
  }
}
