import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';

interface AuthenticatedUser {
  id?: string;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: Error | null,
    user: TUser | false | null,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    if (err || !user) {
      if (info && process.env.NODE_ENV !== 'production') {
        const message = this.formatAuthInfo(info);
        this.logger.warn(`JWT auth failed: ${message}`);
      }
    } else if (this.hasUserId(user)) {
      this.logger.debug(`JWT auth succeeded for userId: ${user.id}`);
    }

    const authenticatedUser = super.handleRequest(err, user, info, context, status);
    return authenticatedUser;
  }

  private hasUserId(user: unknown): user is { id: string } {
    return typeof user === 'object' && user !== null && 'id' in user && typeof user.id === 'string';
  }

  private formatAuthInfo(info: unknown): string {
    if (info instanceof Error) {
      return info.message;
    }

    if (typeof info === 'string') {
      return info;
    }

    return JSON.stringify(info);
  }
}
