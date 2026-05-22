import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '@/auth/interfaces/jwt-payload.interface';
import { cookieOrBearerExtractor } from '@/auth/token-extractor.util';
import { buildJwtVerifyOptions } from '@/auth/jwt-verify-options.util';
import type { AuthenticatedUser } from '@/common/interfaces/request.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: cookieOrBearerExtractor,
      ignoreExpiration: false,
      ...buildJwtVerifyOptions(configService, 'JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Validates the JWT payload without querying the database.
   *
   * Design rationale:
   * - User data embedded in the JWT at login/refresh time includes everything
   *   needed for authorization (role, emailVerified) and display (name, email).
   * - Eliminates N+1 database queries on every authenticated request.
   * - Token lifetime is short (default 15 min) so staleness is bounded.
   * - For real-time ban enforcement, add a Redis deny-list check here
   *   rather than reverting to per-request DB lookups.
   */
  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role as AuthenticatedUser['role'],
      name: payload.name,
      emailVerified: payload.emailVerified,
    };
  }
}
