import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { json } from 'express';

/**
 * Middleware para preservar o raw body da requisição em rotas específicas.
 * Necessário apenas para verificação de assinatura em webhooks.
 *
 * NestJS já configura rawBody: true globalmente via NestFactory.create(),
 * então este middleware é um fallback para casos onde o body já foi
 * consumido pelo parser JSON antes de chegar aqui.
 */
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RawBodyMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Se o rawBody já foi preenchido pelo NestJS (rawBody: true no factory),
    // apenas passa adiante
    if (Buffer.isBuffer(req.rawBody) && req.rawBody.length > 0) {
      next();
      return;
    }

    // Fallback: re-parse com buffer preservation
    json({
      verify: (_req: any, _res: any, buf: Buffer) => {
        _req.rawBody = buf;
      },
    })(req, res, next);
  }
}
