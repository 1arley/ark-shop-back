import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para preservar o raw body da requisição
 * Necessário para verificação de assinatura em webhooks
 */
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      // Armazena o raw body como Buffer
      req.rawBody = Buffer.concat(chunks);
      next();
    });
  }
}
