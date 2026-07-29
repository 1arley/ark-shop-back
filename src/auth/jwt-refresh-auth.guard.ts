import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard('jwt-refresh') implements CanActivate {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
