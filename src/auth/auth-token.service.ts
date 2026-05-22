import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import type { StringValue } from 'ms';
import type { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';

/**
 * AuthTokenService
 *
 * Single responsibility: issue & revoke JWT access/refresh tokens.
 * Extracted from the monolithic AuthService to improve testability
 * and architectural cohesion (arch-single-responsibility).
 */
@Injectable()
export class AuthTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate an access token + refresh token pair for a given user.
   *
   * User data (email, role, emailVerified, name) is embedded in the JWT
   * payload so that guards and controllers can authorize requests without
   * hitting the database on every request (N+1 fix).
   */
  async generateTokenPair(
    user: { id: string; email: string; role: string; emailVerified: boolean; name: string | null },
    options?: { rememberMe?: boolean },
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      jti: crypto.randomUUID(),
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

  /** Persist a hashed refresh token in the database. */
  async createRefreshToken(
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

  /** Revoke a specific refresh token. */
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

  /** Atomically revoke every refresh token belonging to a user (used on password reset). */
  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────

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
    if (!match) return 7 * 24 * 60 * 60 * 1000;

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
}
