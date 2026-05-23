import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { EmailVerifiedGuard } from '@/auth/email-verified.guard';

/**
 * Decorator que requer autenticação JWT E email verificado.
 *
 * Aplica os guards na ordem correta:
 * 1. JwtAuthGuard - valida o token e popula request.user
 * 2. EmailVerifiedGuard - verifica se o email está verificado
 *
 * @example
 * @RequireVerifiedEmail()
 * @Get('protected')
 * getProtected(@Req() req: AuthenticatedRequest) { ... }
 */
export const RequireVerifiedEmail = () => UseGuards(JwtAuthGuard, EmailVerifiedGuard);
