import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  Type,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_EMAIL_VERIFICATION_KEY } from '@/auth/decorators/skip-email-verification.decorator';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import type { AuthenticatedRequest } from '@/common/interfaces/request.interface';
import type { UserProfile } from '@/common/interfaces/user-profile.interface';

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
 * - Delegate to authentication guards when no user is present
 * - Exempt administrative roles from verification
 * - Enforce email verification for regular users
 *
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
 * @Get('protected-resource')
 * getProtectedResource() {
 *   // Only accessible by authenticated users with verified email
 * }
 * ```
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  /** Logger instance for audit trail and debugging */
  private readonly logger = new Logger(EmailVerifiedGuard.name);

  /** Roles exempt from email verification requirement */
  private readonly EXEMPT_ROLES: string[] = ['ADMIN', 'SUPERADMIN'];

  constructor(private readonly reflector: Reflector) {}

  /**
   * Determines if the request can activate based on email verification status.
   *
   * Execution flow:
   * 1. Check if route is marked as public → allow
   * 2. Check if verification is skipped via decorator → allow
   * 3. Check if user is absent → delegate to auth guard
   * 4. Check if user has exempt role → allow
   * 5. Verify user's email is confirmed → reject if not
   *
   * @param context - Execution context containing request metadata
   * @returns `true` if access is granted
   * @throws ForbiddenException if email is not verified
   */
  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const clazz = context.getClass();

    // Priority 1: Check if route is public
    if (this.isPublicRoute(handler as (...args: any[]) => any, clazz)) {
      return true;
    }

    // Priority 2: Check if email verification is explicitly skipped
    if (this.shouldSkipEmailVerification(handler as (...args: any[]) => any, clazz)) {
      return true;
    }

    // Priority 3: Extract and validate user presence
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    // No user present - delegate to authentication guards (JwtAuthGuard)
    // This guard assumes authentication is handled by a preceding guard
    if (!user) {
      this.logger.debug('No user found in request, delegating to authentication guard');
      return true;
    }

    // Priority 4: Check if user role is exempt from verification
    if (this.isExemptRole(user.role)) {
      this.logger.debug(
        `User '${user.id}' with role '${user.role}' is exempt from email verification`,
      );
      return true;
    }

    // Priority 5: Enforce email verification
    if (!user.emailVerified) {
      this.logEmailVerificationFailure(user);
      throw new ForbiddenException(
        'Email not verified. Please verify your email before accessing this resource.',
      );
    }

    this.logger.debug(`Email verification successful for user '${user.id}'`);
    return true;
  }

  /**
   * Checks if the route is marked as public.
   *
   * @param handler - Route handler metadata
   * @param clazz - Controller class metadata
   * @returns `true` if route is public
   */
  private isPublicRoute(handler: (...args: any[]) => any, clazz: Type<any>): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, clazz]);
    return !!isPublic;
  }

  /**
   * Checks if email verification should be skipped for this route.
   *
   * @param handler - Route handler metadata
   * @param clazz - Controller class metadata
   * @returns `true` if verification should be skipped
   */
  private shouldSkipEmailVerification(handler: (...args: any[]) => any, clazz: Type<any>): boolean {
    const skipVerification = this.reflector.getAllAndOverride<boolean>(
      SKIP_EMAIL_VERIFICATION_KEY,
      [handler, clazz],
    );
    return !!skipVerification;
  }

  /**
   * Checks if the user's role is exempt from email verification.
   *
   * Administrative roles (ADMIN, SUPERADMIN) are exempt from the email
   * verification requirement as they have elevated privileges.
   *
   * @param role - The user's role to evaluate
   * @returns `true` if the role is exempt, `false` otherwise
   */
  private isExemptRole(role: string | undefined): boolean {
    if (!role) {
      return false;
    }

    // Normalize role to uppercase for case-insensitive comparison
    const normalizedRole = role.toUpperCase();

    return this.EXEMPT_ROLES.includes(normalizedRole);
  }

  /**
   * Logs email verification failure for audit trail.
   *
   * @param user - User profile that failed verification
   */
  private logEmailVerificationFailure(user: UserProfile): void {
    this.logger.warn(`Email verification failed - User: '${user.id}' (${user.email})`);
  }
}
