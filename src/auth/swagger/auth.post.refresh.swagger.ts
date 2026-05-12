import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';

export function ApiRefreshTokens() {
  return applyDecorators(
    HttpCode(HttpStatus.OK),
    ApiOperation({ summary: 'Renovar tokens' }),
    ApiHeader({
      name: 'Set-Cookie',
      description: 'Novos access_token e refresh_token são definidos como cookies httpOnly',
    }),
    ApiResponse({
      status: 200,
      description: 'Tokens renovados com sucesso. Novos cookies definidos.',
      schema: {
        type: 'object',
        properties: {
          access_token: { type: 'string', example: 'eyJ...' },
        },
      },
    }),
    ApiResponse({
      status: 401,
      description: 'Refresh token inválido ou expirado',
    }),
    ApiResponse({ status: 500, description: 'Erro desconhecido no servidor' }),
  );
}
