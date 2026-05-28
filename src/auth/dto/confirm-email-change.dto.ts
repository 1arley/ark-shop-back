import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmEmailChangeDto {
  @ApiProperty({ description: 'Novo email do usuario' })
  @IsEmail({}, { message: 'O novo email informado nao e valido.' })
  @IsNotEmpty({ message: 'O novo email nao pode estar vazio.' })
  newEmail!: string;

  @ApiProperty({
    description: 'Codigo de confirmacao recebido por email (6 digitos)',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'O codigo de confirmacao nao pode estar vazio.' })
  @Matches(/^\d{6}$/, { message: 'O codigo de confirmacao deve ter exatamente 6 digitos.' })
  code!: string;
}
