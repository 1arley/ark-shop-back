import { IsEmail, IsNotEmpty, IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty({ message: 'O nome não pode estar vazio.' })
  name!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail({}, { message: 'O email informado não é válido.' })
  @IsNotEmpty({ message: 'O email não pode estar vazio.' })
  email!: string;

  @ApiProperty({
    example: 'Str0ng!Pass',
    description:
      'Senha com no mínimo 8 caracteres, contendo letra maiúscula, minúscula, número e caractere especial.',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'A senha não pode estar vazia.' })
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  @MaxLength(128, { message: 'A senha deve ter no máximo 128 caracteres.' })
  @Matches(/[A-Z]/, {
    message: 'A senha deve conter pelo menos uma letra maiúscula.',
  })
  @Matches(/[a-z]/, {
    message: 'A senha deve conter pelo menos uma letra minúscula.',
  })
  @Matches(/[0-9]/, {
    message: 'A senha deve conter pelo menos um número.',
  })
  @Matches(/[^A-Za-z0-9]/, {
    message: 'A senha deve conter pelo menos um caractere especial.',
  })
  password!: string;
}
