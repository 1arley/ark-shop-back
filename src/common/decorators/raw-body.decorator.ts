import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface RequestWithRawBody {
  rawBody?: Buffer;
}

/**
 * Decorator para acessar o raw body da requisição
 * Usado para verificação de assinaturas em webhooks
 */
export const RawBody = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Buffer => {
    const request = ctx
      .switchToHttp()
      .getRequest() as unknown as RequestWithRawBody;
    return request.rawBody as Buffer;
  },
);
