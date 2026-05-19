import { ConfigService } from '@nestjs/config';

type JwtSecretEnvKey = 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET';

/** Passport-jwt options aligned with AuthService.buildSignOptions (iss/aud when configured). */
export function buildJwtVerifyOptions(configService: ConfigService, secretEnvKey: JwtSecretEnvKey) {
  const issuer = configService.get<string>('JWT_ISSUER');
  const audience = configService.get<string>('JWT_AUDIENCE');

  return {
    secretOrKey: configService.getOrThrow<string>(secretEnvKey),
    ...(issuer ? { issuer } : {}),
    ...(audience ? { audience } : {}),
  };
}
