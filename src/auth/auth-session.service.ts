import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthTokenService } from '@/auth/auth-token.service';
import { LoginDto } from '@/auth/dto/login.dto';
import { userPublicSelect } from '@/common/prisma/user-public.select';
import type {
  LoginResult,
  TokenPairResult,
  VerificationStatusResult,
} from '@/auth/interfaces/auth-results.interface';
import type { UserPublic } from '@/common/prisma/user-public.select';

/**
 * AuthSessionService
 *
 * Single responsibility: login, logout, token refresh, and user
 * session queries (validateUser, getVerificationStatus).
 */
@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResult> {
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

    const tokens = await this.authTokenService.generateTokenPair(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        name: user.name,
      },
      { rememberMe },
    );

    // Don't revoke other sessions — each device/client keeps its own refresh token.
    await this.authTokenService.createRefreshToken(user.id, tokens.refresh_token, { rememberMe });

    const { password: _, ...userWithoutPassword } = user;

    return {
      ...tokens,
      user: userWithoutPassword,
      emailVerified: user.emailVerified,
    };
  }

  /**
   * Rotates the refresh token: revokes the old one and creates a new one.
   * Preserves the rememberMe setting from the original token.
   * Uses atomic delete to prevent race conditions on concurrent refresh.
   */
  async refreshTokens(userId: string, oldRefreshToken: string): Promise<TokenPairResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, emailVerified: true, name: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const oldTokenHash = crypto.createHash('sha256').update(oldRefreshToken).digest('hex');
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { token: oldTokenHash, userId },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    const isRememberMe = storedToken.rememberMe;

    const tokens = await this.authTokenService.generateTokenPair(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        name: user.name,
      },
      { rememberMe: isRememberMe },
    );

    // Atomic revocation: deleteMany returns count, only one caller succeeds
    const deleted = await this.prisma.refreshToken.deleteMany({
      where: { token: oldTokenHash, userId },
    });

    if (deleted.count === 0) {
      throw new UnauthorizedException('Refresh token has already been used.');
    }

    await this.authTokenService.createRefreshToken(userId, tokens.refresh_token, {
      rememberMe: isRememberMe,
    });

    return tokens;
  }

  async validateUser(userId: string): Promise<UserPublic> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userPublicSelect,
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return user;
  }

  async getVerificationStatus(userId: string): Promise<VerificationStatusResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return {
      email: user.email,
      emailVerified: user.emailVerified,
    };
  }
}
