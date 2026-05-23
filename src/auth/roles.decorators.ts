import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Reflectable decorator key for the @Roles() decorator.
 * Use with Reflector.getAllAndOverride to retrieve required roles for a route.
 */
export const ROLES_KEY = Reflector.createDecorator<string[]>({
  key: 'roles',
});

/**
 * Decorator that specifies which roles are required to access a route.
 *
 * Supports both individual arguments and array spread from a variable:
 * @Roles('ADMIN', 'MODERATOR')
 * @Roles(...ADMIN_ROLES)
 *
 * @param roles - One or more role names required for access
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
