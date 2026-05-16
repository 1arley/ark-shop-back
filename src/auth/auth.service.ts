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
import {
  DEFAULT_BCRYPT_SALT_ROUNDS,
  PASSWORD_RESET_EXPIRY_HOURS,
  HOUR_IN_MS,
  EMAIL_VERIFICATION_CODE_LENGTH,
  EMAIL_VERIFICATION_EXPIRY_HOURS,
  PASSWORD_RESET_CODE_LENGTH,
  MINUTE_IN_MS,
} from '@/common/constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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

    // Send verification email (non-blocking — registration should succeed even if email fails)
    this.emailService.sendEmailVerification(email, verificationCode, email).catch(err => {
      this.logger.warn(
        `Failed to send verification email: ${err instanceof Error ? err.message : err}`,
      );
    });

    // Generate tokens for auto-login after registration
    const tokens = await this.getTokens(user.id, user.email, user.role, { rememberMe: false });
    await this.createRefreshToken(user.id, tokens.refresh_token, { rememberMe: false });

    const { password: _, ...userWithoutPassword } = user;

    return {
      ...tokens,
      user: userWithoutPassword,
      emailVerificationRequired: true,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password, rememberMe } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const tokens = await this.getTokens(user.id, user.email, user.role, { rememberMe });

    // Não revoga tokens de outras sessões: cada dispositivo/contexto mantém
    // seu próprio refresh token. Tokens antigos expiram naturalmente.
    await this.createRefreshToken(user.id, tokens.refresh_token, { rememberMe });

    const { password: _, ...userWithoutPassword } = user;

    return {
      ...tokens,
      user: userWithoutPassword,
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Rotaciona o refresh token: revoga o token antigo e cria um novo.
   * Preserva a configuração rememberMe do token original.
   * Apenas o token usado é revogado — outras sessões permanecem ativas.
   */
  async refreshTokens(userId: string, oldRefreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    // Verifica se o token antigo era rememberMe (30 dias) para preservar
    const oldTokenHash = crypto.createHash('sha256').update(oldRefreshToken).digest('hex');
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { token: oldTokenHash },
    });

    // Se o token expira em mais de 15 dias, era rememberMe
    const isRememberMe = storedToken
      ? storedToken.expiresAt.getTime() - Date.now() > 15 * 24 * 60 * 60 * 1000
      : false;

    const tokens = await this.getTokens(userId, user.email, user.role, {
      rememberMe: isRememberMe,
    });

    // Revoga APENAS o token usado (mantém outras sessões ativas)
    await this.revokeRefreshToken(oldRefreshToken).catch(() => {
      // Token já revogado ou expirado — apenas cria o novo
    });
    await this.createRefreshToken(userId, tokens.refresh_token, { rememberMe: isRememberMe });

    return tokens;
  }

  private async getTokens(
    userId: string,
    email: string,
    role: string,
    options?: { rememberMe?: boolean },
  ) {
    const payload = { sub: userId, email, role, jti: crypto.randomUUID() };

    // Access token: sempre 30 minutos (renovável enquanto o usuário estiver ativo)
    const accessExpiresIn = '30m';

    // Refresh token: 30 dias se rememberMe, senão 7 dias
    const refreshExpiresIn = options?.rememberMe
      ? '30d'
      : this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessExpiresIn as StringValue,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn as StringValue,
      }),
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
    this.emailService.sendPasswordReset(email, token, email).catch(err => {
      this.logger.warn(
        `Failed to send password reset email: ${err instanceof Error ? err.message : err}`,
      );
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
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_CODE_LENGTH * MINUTE_IN_MS);

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
    this.emailService.sendPasswordResetWithCode(email, resetCode, email).catch(err => {
      this.logger.warn(
        `Failed to send password reset code email: ${err instanceof Error ? err.message : err}`,
      );
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
    this.emailService.sendEmailVerification(email, verificationCode, email).catch(err => {
      this.logger.warn(
        `Failed to send verification email: ${err instanceof Error ? err.message : err}`,
      );
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
}
