import { IsEmail, IsNotEmpty, IsString, Matches, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token received by email' })
  @IsString()
  @IsNotEmpty({ message: 'O token não pode estar vazio.' })
  token!: string;

  @ApiProperty({ description: 'User email' })
  @IsEmail({}, { message: 'O email informado não é válido.' })
  @IsNotEmpty({ message: 'O email não pode estar vazio.' })
  email!: string;

  @ApiProperty({
    description: 'New password',
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
