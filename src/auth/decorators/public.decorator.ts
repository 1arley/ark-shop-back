import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Reflectable decorator key for the @Public() decorator.
 * Use with Reflector.getAllAndOverride to check if a route is public.
 */
export const IS_PUBLIC_KEY = Reflector.createDecorator<boolean>({
  key: 'isPublic',
  transform: () => true,
});

/**
 * Decorator that marks a route as public (no authentication required).
 *
 * @example
 * ```typescript
 * @Public()
 * @Get('public-route')
 * getPublicResource() {}
 * ```
 */
export const Public = () => SetMetadata('isPublic', true);
