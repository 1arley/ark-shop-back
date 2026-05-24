import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_EMAIL_VERIFICATION_KEY } from '@/auth/decorators/skip-email-verification.decorator';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import type { AuthenticatedRequest } from '@/common/interfaces/request.interface';

/**
 * Guardian that ensures user's email is verified before accessing protected resources.
 *
 * This guard implements a defense-in-depth strategy by verifying email confirmation
 * at the authorization layer. It should be used in conjunction with JwtAuthGuard
 * to ensure both authentication and email verification are enforced.
 *
 * Key responsibilities:
 * - Bypass verification for public routes
 * - Skip verification when explicitly decorated
 * - Exempt administrative roles from verification
 * - Enforce email verification for regular users
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  private readonly logger = new Logger(EmailVerifiedGuard.name);
  private readonly EXEMPT_ROLES = ['ADMIN', 'SUPERADMIN'];

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const clazz = context.getClass();
    const handlerName = typeof handler === 'function' ? handler.name : 'unknown';
    const className = clazz?.name || 'UnknownClass';

    this.logger.log(`EmailVerifiedGuard called for ${className}.${handlerName}`);

    // Priority 1: Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, clazz]);

    if (isPublic) {
      this.logger.log('Route is public, allowing access');
      return true;
    }

    // Priority 2: Check if email verification is explicitly skipped
    const skipVerification = this.reflector.getAllAndOverride<boolean>(
      SKIP_EMAIL_VERIFICATION_KEY,
      [handler, clazz],
    );

    if (skipVerification) {
      return true;
    }

    // Priority 3: Extract and validate user presence
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    this.logger.log(`EmailVerifiedGuard - User from request: ${JSON.stringify(user)}`);

    // No user present - this should not happen if JwtAuthGuard is properly configured
    // Return true to let the authentication guard handle it
    if (!user) {
      this.logger.debug('No user found in request, delegating to authentication guard');
      return true;
    }

    this.logger.log(
      `Checking email verification for user: ${user.id}, role: ${user.role}, emailVerified: ${user.emailVerified}`,
    );

    // Priority 4: Check if user role is exempt from verification
    if (this.isExemptRole(user.role)) {
      this.logger.debug(`User has exempt role: ${user.role}`);
      return true;
    }

    // Priority 5: Enforce email verification
    // Note: emailVerified can be undefined, null, or false - all should be treated as not verified
    if (!user.emailVerified) {
      this.logger.warn(
        `Email verification required for user: ${user.id}, emailVerified: ${user.emailVerified}`,
      );
      throw new ForbiddenException(
        'Email not verified. Please verify your email before accessing this resource.',
      );
    }

    this.logger.log(`Email verified for user: ${user.id}`);
    return true;
  }

  private isExemptRole(role: string): boolean {
    return this.EXEMPT_ROLES.includes(role);
  }
}
