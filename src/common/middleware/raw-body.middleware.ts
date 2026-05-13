import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para preservar o raw body da requisição
 * Necessário para verificação de assinatura em webhooks
 *
 * Usa express.raw() para capturar o body antes de qualquer parser JSON.
 * Isso garante que req.rawBody seja um Buffer com os bytes exatos.
 */
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Se o rawBody já foi preenchido (ex: por rawBody: true do NestJS),
    // apenas passa adiante
    if (req.rawBody && Buffer.isBuffer(req.rawBody) && req.rawBody.length > 0) {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    let totalLength = 0;

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      totalLength += chunk.length;
    });

    req.on('end', () => {
      if (totalLength > 0) {
        req.rawBody = Buffer.concat(chunks, totalLength);
      } else {
        // Body vazio — usa o body parseado como fallback
        req.rawBody = req.body ? Buffer.from(JSON.stringify(req.body)) : Buffer.alloc(0);
      }
      next();
    });

    req.on('error', err => {
      console.error('RawBodyMiddleware error:', err);
      next(err);
    });
  }
}
