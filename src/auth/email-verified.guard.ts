import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_EMAIL_VERIFICATION_KEY } from '@/auth/decorators/skip-email-verification.decorator';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import type { AuthenticatedRequest } from '@/common/interfaces/request.interface';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const skipVerification = this.reflector.getAllAndOverride<boolean>(
      SKIP_EMAIL_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipVerification) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    // If there's no user on the request, this guard is running before
    // (or without) JwtAuthGuard. Since public endpoints are already
    // handled above, returning true here is a safe fallback — the
    // JwtAuthGuard (which runs first via @UseGuards order) will block
    // unauthenticated requests with a 401.
    if (!user) {
      return true;
    }

    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
      return true;
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Email not verified. Please verify your email before accessing this resource.',
      );
    }

    return true;
  }
}
