import { ExtractJwt } from 'passport-jwt';
import type { Request } from 'express';

export function cookieOrBearerExtractor(req: Request): string | null {
  if (req?.cookies?.access_token) {
    return req.cookies.access_token;
  }

  const bearerToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (bearerToken) {
    return bearerToken;
  }

  return null;
}

export function extractRefreshToken(req: Request): string | null {
  if (req?.cookies?.refresh_token) {
    return req.cookies.refresh_token;
  }

  const refreshHeader = req.get('x-refresh-token');
  if (refreshHeader) {
    return refreshHeader.trim();
  }

  if (req?.headers) {
    const bearerToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (bearerToken) {
      return bearerToken;
    }
  }

  return null;
}
