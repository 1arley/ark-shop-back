import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiFindAllUsers() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({ summary: 'Listar todos os usuários (Apenas ADMIN)' }),
    HttpCode(HttpStatus.OK),
    ApiResponse({
      status: 200,
      description: 'Lista de usuários retornada com sucesso',
      schema: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            name: { type: 'string', example: 'João Silva' },
            email: { type: 'string', example: 'joao@ark-shop.com' },
            createdAt: { type: 'string', example: '2025-10-24T10:00:00.000Z' },
            updatedAt: { type: 'string', example: '2025-10-24T10:00:00.000Z' },
          },
        },
      },
    }),
    ApiResponse({ status: 401, description: 'Não autenticado' }),
    ApiResponse({ status: 403, description: 'Sem permissão (apenas ADMIN)' }),
    ApiResponse({ status: 500, description: 'Erro desconhecido no servidor' }),
  );
}
