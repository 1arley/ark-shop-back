import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

export function ApiLogoutUser() {
  return applyDecorators(
    HttpCode(HttpStatus.OK),
    ApiOperation({ summary: 'Realizar logout' }),
    ApiBearerAuth('JWT-auth'),
    ApiResponse({
      status: 200,
      description: 'Logout realizado com sucesso. Cookies limpos.',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Logout realizado com sucesso.',
          },
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Token de acesso inválido' }),
    ApiResponse({ status: 500, description: 'Erro desconhecido no servidor' }),
  );
}
