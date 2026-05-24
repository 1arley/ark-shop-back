import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { LoginDto } from '@/auth/dto/login.dto';
import { RegisterDto } from '@/auth/dto/register.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { VerifyEmailDto } from '@/auth/dto/verify-email.dto';
import { ResetPasswordWithCodeDto } from '@/auth/dto/reset-password-code.dto';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '@/modules/email/email.service';

import type { StringValue } from 'ms';
import type { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { userPublicSelect } from '@/common/prisma/user-public.select';
import {
  DEFAULT_BCRYPT_SALT_ROUNDS,
  PASSWORD_RESET_EXPIRY_HOURS,
  HOUR_IN_MS,
  EMAIL_VERIFICATION_CODE_LENGTH,
  EMAIL_VERIFICATION_EXPIRY_HOURS,
  PASSWORD_RESET_CODE_LENGTH,
  PASSWORD_RESET_CODE_EXPIRY_MINUTES,
  MINUTE_IN_MS,
} from '@/common/constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private emailFailureCount = 0;
  private readonly EMAIL_FAILURE_THRESHOLD = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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

    // Use configurable bcrypt salt rounds (default 12 for production security)
    const saltRounds = this.getSaltRounds();
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
    // (user can request resend if email fails)
    this.emailService
      .sendEmailVerification(email, verificationCode, name)
      .then(() => {
        this.emailFailureCount = 0;
      })
      .catch(err => {
        this.emailFailureCount++;
        const errorMessage = err instanceof Error ? err.message : err;
        if (this.emailFailureCount >= this.EMAIL_FAILURE_THRESHOLD) {
          this.logger.error(`Email service failed ${this.emailFailureCount} times consecutively`);
        } else {
          this.logger.warn(
            `Failed to send verification email: ${errorMessage} (${this.emailFailureCount}/${this.EMAIL_FAILURE_THRESHOLD})`,
          );
        }
      });

    const { password: _, ...userWithoutPassword } = user;

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      user: userWithoutPassword,
      emailVerificationRequired: true,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password, rememberMe } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...userPublicSelect, password: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const tokens = await this.getTokens(user.id, user.role, { rememberMe });

    // Não revoga tokens de outras sessões: cada dispositivo/contexto mantém
    // seu próprio refresh token. Tokens antigos expiram naturalmente.
    await this.createRefreshToken(user.id, tokens.refresh_token, { rememberMe });

    const { password: _, ...userWithoutPassword } = user;

    return {
      ...tokens,
      user: userWithoutPassword,
      emailVerified: user.emailVerified,
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userPublicSelect,
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return user;
  }

  /**
   * Rotaciona o refresh token: revoga o token antigo e cria um novo.
   * Preserva a configuração rememberMe do token original.
   * Apenas o token usado é revogado — outras sessões permanecem ativas.
   * Uses atomic delete to prevent race conditions on concurrent refresh.
   */
  async refreshTokens(userId: string, oldRefreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const oldTokenHash = crypto.createHash('sha256').update(oldRefreshToken).digest('hex');
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { token: oldTokenHash },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    const isRememberMe = storedToken.rememberMe;

    const tokens = await this.getTokens(userId, user.role, {
      rememberMe: isRememberMe,
    });

    // Atomic revocation: deleteMany returns count, only one caller succeeds
    const deleted = await this.prisma.refreshToken.deleteMany({
      where: { token: oldTokenHash, userId },
    });

    if (deleted.count === 0) {
      throw new UnauthorizedException('Refresh token has already been used.');
    }

    await this.createRefreshToken(userId, tokens.refresh_token, { rememberMe: isRememberMe });

    return tokens;
  }

  private async getTokens(userId: string, role: string, options?: { rememberMe?: boolean }) {
    // Fetch user data to include in JWT payload
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true, name: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const payload: JwtPayload = {
      sub: userId,
      role,
      jti: crypto.randomUUID(),
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name || undefined,
    };

    const accessExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';

    const refreshExpiresIn = options?.rememberMe
      ? '30d'
      : this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, this.buildSignOptions(accessExpiresIn, 'access')),
      this.jwtService.signAsync(payload, this.buildSignOptions(refreshExpiresIn, 'refresh')),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      access_expires_in: this.parseExpiresInToSeconds(accessExpiresIn),
      refresh_expires_in: this.parseExpiresInToSeconds(refreshExpiresIn),
      remember_me: options?.rememberMe ?? false,
    };
  }

  /**
   * Parse a string like "15m", "7d", "1h" into milliseconds.
   * Used by both parseExpiresInToSeconds and createRefreshToken (DRY).
   */
  private buildSignOptions(expiresIn: string, kind: 'access' | 'refresh') {
    const secretKey = kind === 'access' ? 'JWT_ACCESS_SECRET' : 'JWT_REFRESH_SECRET';
    const issuer = this.configService.get<string>('JWT_ISSUER')?.trim() || undefined;
    const audience = this.configService.get<string>('JWT_AUDIENCE')?.trim() || undefined;

    return {
      secret: this.configService.getOrThrow<string>(secretKey),
      expiresIn: expiresIn as StringValue,
      ...(issuer ? { issuer } : {}),
      ...(audience ? { audience } : {}),
    };
  }

  private parseExpiresInToMs(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 dias

    const value = parseInt(match[1]!, 10);
    const unit = match[2]!;
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * (multipliers[unit] || 7 * 24 * 60 * 60 * 1000);
  }

  private parseExpiresInToSeconds(expiresIn: string): number {
    return Math.floor(this.parseExpiresInToMs(expiresIn) / 1000);
  }

  private async createRefreshToken(
    userId: string,
    token: string,
    options?: { rememberMe?: boolean },
  ): Promise<void> {
    const expiresIn = options?.rememberMe
      ? '30d'
      : this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
    const expiresAt = new Date(Date.now() + this.parseExpiresInToMs(expiresIn));

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId,
        expiresAt,
        rememberMe: options?.rememberMe ?? false,
      },
    });
  }

  private async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { token: tokenHash },
    });

    if (!storedToken) {
      throw new NotFoundException('Refresh token não encontrado.');
    }

    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });
  }

  async forgotPassword(email: string) {
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
    this.emailService
      .sendPasswordReset(email, token, email)
      .then(() => {
        this.emailFailureCount = 0;
      })
      .catch(err => {
        this.emailFailureCount++;
        const errorMessage = err instanceof Error ? err.message : err;
        if (this.emailFailureCount >= this.EMAIL_FAILURE_THRESHOLD) {
          this.logger.error(`Email service failed ${this.emailFailureCount} times consecutively`);
        } else {
          this.logger.warn(
            `Failed to send password reset email: ${errorMessage} (${this.emailFailureCount}/${this.EMAIL_FAILURE_THRESHOLD})`,
          );
        }
      });

    return { message: 'Se o email existir, um link de redefinicao sera enviado.' };
  }

  /**
   * Solicita redefinicao de senha via codigo OTP (6 digitos).
   * Alternativa ao link de redefinicao.
   */
  async forgotPasswordWithCode(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { message: 'Se o email existir, um codigo de redefinicao sera enviado.' };
    }

    const resetCode = this.generateNumericCode(PASSWORD_RESET_CODE_LENGTH);
    const codeHash = crypto.createHash('sha256').update(resetCode).digest('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_EXPIRY_MINUTES * MINUTE_IN_MS);

    // Invalida codigos anteriores nao usados
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
    this.emailService
      .sendPasswordResetWithCode(email, resetCode, email)
      .then(() => {
        this.emailFailureCount = 0;
      })
      .catch(err => {
        this.emailFailureCount++;
        const errorMessage = err instanceof Error ? err.message : err;
        if (this.emailFailureCount >= this.EMAIL_FAILURE_THRESHOLD) {
          this.logger.error(`Email service failed ${this.emailFailureCount} times consecutively`);
        } else {
          this.logger.warn(
            `Failed to send password reset code email: ${errorMessage} (${this.emailFailureCount}/${this.EMAIL_FAILURE_THRESHOLD})`,
          );
        }
      });

    return { message: 'Se o email existir, um codigo de redefinicao sera enviado.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
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

    // Revoga todos os refresh tokens apos redefinicao de senha
    await this.revokeAllUserRefreshTokens(user.id);

    return { message: 'Senha redefinida com sucesso.' };
  }

  /**
   * Redefine senha usando codigo OTP recebido por email.
   */
  async resetPasswordWithCode(dto: ResetPasswordWithCodeDto) {
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

    // Revoga todos os refresh tokens apos redefinicao de senha
    await this.revokeAllUserRefreshTokens(user.id);

    return { message: 'Senha redefinida com sucesso.' };
  }

  /**
   * Verifica o email do usuario usando o codigo recebido.
   */
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

  /**
   * Reenvia o email de verificacao para o usuario.
   */
  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: 'Se o email existir, um novo codigo sera enviado.' };
    }

    if (user.emailVerified) {
      return { message: 'Email ja esta verificado.', emailVerified: true };
    }

    // Invalida codigos anteriores nao usados
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
    this.emailService
      .sendEmailVerification(email, verificationCode, email)
      .then(() => {
        this.emailFailureCount = 0;
      })
      .catch(err => {
        this.emailFailureCount++;
        const errorMessage = err instanceof Error ? err.message : err;
        if (this.emailFailureCount >= this.EMAIL_FAILURE_THRESHOLD) {
          this.logger.error(`Email service failed ${this.emailFailureCount} times consecutively`);
        } else {
          this.logger.warn(
            `Failed to send verification email: ${errorMessage} (${this.emailFailureCount}/${this.EMAIL_FAILURE_THRESHOLD})`,
          );
        }
      });

    return { message: 'Se o email existir, um novo codigo sera enviado.' };
  }

  /**
   * Gera um codigo numerico aleatorio de tamanho especificado.
   */
  private generateNumericCode(length: number): string {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += crypto.randomInt(0, 10).toString();
    }
    return code;
  }

  private getSaltRounds(): number {
    const config = parseInt(
      this.configService.get<string>('BCRYPT_SALT_ROUNDS') || String(DEFAULT_BCRYPT_SALT_ROUNDS),
    );
    const valid = !Number.isNaN(config) && config >= 4 && config <= 31;
    const result = valid ? config : DEFAULT_BCRYPT_SALT_ROUNDS;

    if (!valid) {
      this.logger.warn(`Invalid BCRYPT_SALT_ROUNDS (${config}), using default ${result}`);
    }

    return result;
  }
}
