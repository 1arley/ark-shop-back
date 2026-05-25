import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { cookieOrBearerExtractor } from '@/auth/token-extractor.util';
import { buildJwtVerifyOptions } from '@/auth/jwt-verify-options.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const verifyOptions = buildJwtVerifyOptions(configService, 'JWT_ACCESS_SECRET');
    const issuer = configService.get<string>('JWT_ISSUER');
    const audience = configService.get<string>('JWT_AUDIENCE');

    if (process.env.NODE_ENV !== 'production') {
      Logger.debug(
        `JWT verify options — secret: ${verifyOptions.secretOrKey.substring(0, 8)}..., issuer: ${issuer ? 'set' : 'none'}, audience: ${audience ? 'set' : 'none'}`,
        'JwtStrategy',
      );
    }

    super({
      jwtFromRequest: cookieOrBearerExtractor,
      ignoreExpiration: false,
      ...verifyOptions,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        emailVerified: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return user;
  }
}
