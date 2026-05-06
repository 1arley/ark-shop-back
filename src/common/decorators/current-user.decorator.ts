import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Extracts user from JWT token
 * Usage: @CurrentUser() user
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }
    
    return user;
  },
);

/**
 * Extracts user from JWT token (optional)
 * Usage: @CurrentUserOptional() user (can be undefined)
 */
export const CurrentUserOptional = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user || null;
  },
);
