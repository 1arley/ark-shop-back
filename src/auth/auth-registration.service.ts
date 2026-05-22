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

  async register(registerDto: RegisterDto) {
    const { name, email, password } = registerDto;

    const userExists = await this.prisma.user.findUnique({
      where: { email },
    });

    if (userExists) {
      throw new ConflictException('Email already registered.');
    }

    const saltRounds = parseInt(
      this.configService.get<string>('BCRYPT_SALT_ROUNDS') || String(DEFAULT_BCRYPT_SALT_ROUNDS),
    );
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'USER',
      },
    });

    // Generate email verification code
    const verificationCode = this.generateNumericCode(EMAIL_VERIFICATION_CODE_LENGTH);
    const codeHash = crypto.createHash('sha256').update(verificationCode).digest('hex');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * HOUR_IN_MS);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        code: codeHash,
        expiresAt,
      },
    });

    // Send verification email — non-blocking so registration always succeeds
    this.emailService.sendEmailVerification(email, verificationCode, name).catch(err => {
      this.logger.error(
        `Failed to send verification email to ${email}: ${err instanceof Error ? err.message : err}`,
      );
    });

    const { password: _, ...userWithoutPassword } = user;

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      user: userWithoutPassword,
      emailVerificationRequired: true,
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const { email, code } = dto;

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new BadRequestException('Codigo de verificacao invalido.');
    }

    if (user.emailVerified) {
      return { message: 'Email ja verificado.', emailVerified: true };
    }

    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const verificationToken = await this.prisma.emailVerificationToken.findFirst({
      where: {
        code: codeHash,
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verificationToken) {
      throw new BadRequestException('Codigo de verificacao invalido ou expirado.');
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      }),
    ]);

    return { message: 'Email verificado com sucesso.', emailVerified: true };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: 'Se o email existir, um novo codigo sera enviado.' };
    }

    if (user.emailVerified) {
      return { message: 'Email ja esta verificado.', emailVerified: true };
    }

    // Invalidate previous unused codes
    await this.prisma.emailVerificationToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    const verificationCode = this.generateNumericCode(EMAIL_VERIFICATION_CODE_LENGTH);
    const codeHash = crypto.createHash('sha256').update(verificationCode).digest('hex');
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * HOUR_IN_MS);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        code: codeHash,
        expiresAt,
      },
    });

    // Send verification email (non-blocking — code already created)
    this.emailService.sendEmailVerification(email, verificationCode, email).catch(err => {
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
