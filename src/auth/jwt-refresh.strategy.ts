import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { Request } from 'express';
import * as crypto from 'crypto';
import { extractRefreshToken } from '@/auth/token-extractor.util';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: extractRefreshToken,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const refreshToken = extractRefreshToken(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token não fornecido.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) throw new UnauthorizedException('Usuário não encontrado.');

    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: user.id,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    if (storedTokens.length === 0) {
      throw new UnauthorizedException('Nenhum refresh token válido encontrado.');
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    let tokenValid = false;
    for (const storedToken of storedTokens) {
      if (tokenHash === storedToken.token) {
        tokenValid = true;
        break;
      }
    }

    if (!tokenValid) {
      throw new UnauthorizedException('Refresh token inválido ou não corresponde ao usuário.');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      refreshToken,
    };
  }
}
