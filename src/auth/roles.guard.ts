import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@/auth/roles.decorators';
import { AuthenticatedRequest } from '@/common/interfaces/request.interface';
import { ROLE_HIERARCHY, Role } from '@/common/enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado.');
    }

    // Verifica se o usuário tem pelo menos o nível de acesso requerido
    const userLevel = ROLE_HIERARCHY[user.role] ?? -1;
    const hasRequiredLevel = requiredRoles.some(role => {
      const requiredLevel = ROLE_HIERARCHY[role as Role];
      // Se o role não estiver na hierarquia, requer match exato
      if (requiredLevel === undefined) {
        return user.role === role;
      }
      // Se o usuário não tiver nível definido, não permite acesso
      if (userLevel === -1) {
        return false;
      }
      return userLevel >= requiredLevel;
    });

    if (!hasRequiredLevel) {
      throw new ForbiddenException('Você não tem permissão para acessar este recurso.');
    }

    return true;
  }
}
