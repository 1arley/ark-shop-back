import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@/auth/roles.decorators';
import type { AuthenticatedRequest } from '@/common/interfaces/request.interface';

/**
 * Hierarquia de permissões:
 *   SUPERADMIN = 3 → pode tudo que ADMIN + USER fazem + ações exclusivas
 *   ADMIN      = 2 → pode tudo que USER faz + gerenciamento
 *   USER       = 1 → apenas ações do próprio perfil
 */
const ROLE_HIERARCHY: Record<string, number> = {
  SUPERADMIN: 3,
  ADMIN: 2,
  USER: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado.');
    }

    const userLevel = ROLE_HIERARCHY[user.role] ?? 0;

    // Verifica se o usuário tem nível hierárquico suficiente.
    // Se a rota exige ADMIN, SUPERADMIN (nível 3) também passa.
    const hasAccess = requiredRoles.some(role => {
      const requiredLevel = ROLE_HIERARCHY[role] ?? 0;
      return userLevel >= requiredLevel;
    });

    if (!hasAccess) {
      throw new ForbiddenException('Você não tem permissão para acessar este recurso.');
    }

    return true;
  }
}
