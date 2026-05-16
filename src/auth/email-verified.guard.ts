import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_EMAIL_VERIFICATION_KEY } from '@/auth/decorators/skip-email-verification.decorator';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import type { AuthenticatedRequest } from '@/common/interfaces/request.interface';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip if route is public (no authentication required)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Skip if explicitly marked to bypass email verification
    const skipVerification = this.reflector.getAllAndOverride<boolean>(
      SKIP_EMAIL_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipVerification) {
      return true;
    }

    // Check if user's email is verified
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      // No user on request — let JwtAuthGuard handle authentication first
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
