import { IsEmail, IsNotEmpty, IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordWithCodeDto {
  @ApiProperty({ description: 'Email do usuario' })
  @IsEmail({}, { message: 'O email informado nao e valido.' })
  @IsNotEmpty({ message: 'O email nao pode estar vazio.' })
  email!: string;

  @ApiProperty({ description: 'Codigo de redefinicao recebido por email' })
  @IsString()
  @IsNotEmpty({ message: 'O codigo nao pode estar vazio.' })
  code!: string;

  @ApiProperty({
    description: 'Nova senha',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'A senha nao pode estar vazia.' })
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  @MaxLength(128, { message: 'A senha deve ter no maximo 128 caracteres.' })
  @Matches(/[A-Z]/, {
    message: 'A senha deve conter pelo menos uma letra maiuscula.',
  })
  @Matches(/[a-z]/, {
    message: 'A senha deve conter pelo menos uma letra minuscula.',
  })
  @Matches(/[0-9]/, {
    message: 'A senha deve conter pelo menos um numero.',
  })
  @Matches(/[^A-Za-z0-9]/, {
    message: 'A senha deve conter pelo menos um caractere especial.',
  })
  password!: string;
}
