import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator para acessar o raw body da requisição
 * Usado para verificação de assinaturas em webhooks
 */
export const RawBody = createParamDecorator((_data: unknown, ctx: ExecutionContext): Buffer => {
  const request = ctx.switchToHttp().getRequest();
  return request.rawBody!;
});
