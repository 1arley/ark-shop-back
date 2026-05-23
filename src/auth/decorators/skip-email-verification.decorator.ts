import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Reflectable decorator key for the @SkipEmailVerification() decorator.
 * Use with Reflector.getAllAndOverride to check if email verification is skipped.
 */
export const SKIP_EMAIL_VERIFICATION_KEY = Reflector.createDecorator<boolean>({
  key: 'skipEmailVerification',
  transform: () => true,
});

/**
 * Decorator that skips email verification for a route.
 *
 * @example
 * ```typescript
 * @SkipEmailVerification()
 * @Get('no-verify')
 * getWithoutVerification() {}
 * ```
 */
export const SkipEmailVerification = () => SetMetadata('skipEmailVerification', true);
