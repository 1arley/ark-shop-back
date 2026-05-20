import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

type JwtSecretEnvKey = 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET';

/** Passport-jwt options aligned with AuthService.buildSignOptions (iss/aud when configured). */
export function buildJwtVerifyOptions(configService: ConfigService, secretEnvKey: JwtSecretEnvKey) {
  const rawIssuer = configService.get<string>('JWT_ISSUER');
  const rawAudience = configService.get<string>('JWT_AUDIENCE');

  // Trim whitespace and treat empty strings as undefined
  const issuer = rawIssuer?.trim() || undefined;
  const audience = rawAudience?.trim() || undefined;

  // Log in production for debugging JWT mismatches
  if (process.env.NODE_ENV === 'production') {
    const logger = new Logger('JwtVerifyOptions');
    logger.log(
      `${secretEnvKey} — issuer: ${issuer ? `"${issuer}"` : 'none'}, audience: ${audience ? `"${audience}"` : 'none'}`,
    );
  }

  return {
    secretOrKey: configService.getOrThrow<string>(secretEnvKey),
    ...(issuer ? { issuer } : {}),
    ...(audience ? { audience } : {}),
  };
}
