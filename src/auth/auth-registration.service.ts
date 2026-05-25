import { Injectable, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService } from '@/modules/email/email.service';
import { RegisterDto } from '@/auth/dto/register.dto';
import { VerifyEmailDto } from '@/auth/dto/verify-email.dto';
import {
  DEFAULT_BCRYPT_SALT_ROUNDS,
  EMAIL_VERIFICATION_CODE_LENGTH,
  EMAIL_VERIFICATION_EXPIRY_HOURS,
  HOUR_IN_MS,
} from '@/common/constants';
import type {
  RegisterResult,
  EmailVerificationResult,
  MessageResult,
} from '@/auth/interfaces/auth-results.interface';

/**
 * AuthRegistrationService
 *
 * Single responsibility: user registration, email verification, and
 * verification-email resend flow.
 */
@Injectable()
export class AuthRegistrationService {
  private readonly logger = new Logger(AuthRegistrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResult> {
    const { name, email, password } = registerDto;

    const userExists = await this.prisma.user.findUnique({
      where: { email },
    });

    if (userExists) {
      throw new ConflictException('Email already registered.');
    }

    const pendingExists = await this.prisma.pendingRegistration.findUnique({
      where: { email },
    });

    if (pendingExists) {
      throw new ConflictException(
        'A verification is already pending for this email. Please check your email or request a new code.',
      );
    }

    const saltRounds = parseInt(
      this.configService.get<string>('BCRYPT_SALT_ROUNDS') || String(DEFAULT_BCRYPT_SALT_ROUNDS),
    );
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const verificationCode = this.generateNumericCode(EMAIL_VERIFICATION_CODE_LENGTH);
    const codeHash = crypto.createHash('sha256').update(verificationCode).digest('hex');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * HOUR_IN_MS);

    await this.prisma.pendingRegistration.create({
      data: {
        name,
        email,
        password: hashedPassword,
        code: codeHash,
        expiresAt,
      },
    });

    this.emailService.sendEmailVerification(email, verificationCode, name).catch(err => {
      this.logger.error(
        `Failed to send verification email to ${email}: ${err instanceof Error ? err.message : err}`,
      );
    });

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      emailVerificationRequired: true,
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<EmailVerificationResult> {
    const { email, code } = dto;

    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { email },
    });

    if (!pending) {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (user?.emailVerified) {
        return { message: 'Email ja verificado.', emailVerified: true };
      }
      throw new BadRequestException('Codigo de verificacao invalido.');
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    if (pending.code !== codeHash) {
      throw new BadRequestException('Codigo de verificacao invalido ou expirado.');
    }

    if (pending.expiresAt < new Date()) {
      throw new BadRequestException('Codigo de verificacao expirado. Solicite um novo codigo.');
    }

    await this.prisma.$transaction(async tx => {
      await tx.pendingRegistration.delete({
        where: { id: pending.id },
      });

      await tx.user.create({
        data: {
          name: pending.name,
          email: pending.email,
          password: pending.password,
          role: 'USER',
          emailVerified: true,
        },
      });
    });

    return { message: 'Email verificado com sucesso.', emailVerified: true };
  }

  async resendVerificationEmail(email: string): Promise<MessageResult | EmailVerificationResult> {
    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { email },
    });

    if (!pending) {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (user?.emailVerified) {
        return { message: 'Email ja esta verificado.', emailVerified: true };
      }
      return { message: 'Se o email existir, um novo codigo sera enviado.' };
    }

    const verificationCode = this.generateNumericCode(EMAIL_VERIFICATION_CODE_LENGTH);
    const codeHash = crypto.createHash('sha256').update(verificationCode).digest('hex');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * HOUR_IN_MS);

    await this.prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: {
        code: codeHash,
        expiresAt,
      },
    });

    this.emailService
      .sendEmailVerification(email, verificationCode, pending.name || email)
      .catch(err => {
        this.logger.error(
          `Failed to send verification email to ${email}: ${err instanceof Error ? err.message : err}`,
        );
      });

    return { message: 'Se o email existir, um novo codigo sera enviado.' };
  }

  /**
   * Generates a random numeric code of specified length.
   * Used for email verification codes and password reset codes.
   */
  private generateNumericCode(length: number): string {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += crypto.randomInt(0, 10).toString();
    }
    return code;
  }
}
