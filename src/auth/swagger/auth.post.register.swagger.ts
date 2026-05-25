import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

export function ApiRegisterUser() {
  return applyDecorators(
    ApiOperation({ summary: 'Solicitar registro de novo usuário' }),
    HttpCode(HttpStatus.CREATED),
    ApiBearerAuth('JWT-auth'),
    ApiResponse({
      status: 201,
      description: 'Registro solicitado com sucesso. Verifique o email para ativar a conta.',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Registration successful. Please check your email to verify your account.',
          },
          emailVerificationRequired: {
            type: 'boolean',
            example: true,
          },
        },
      },
    }),
    ApiResponse({ status: 409, description: 'Email já cadastrado' }),
    ApiResponse({ status: 500, description: 'Erro desconhecido no servidor' }),
  );
}
