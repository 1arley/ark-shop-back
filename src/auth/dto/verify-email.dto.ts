import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email do usuario' })
  @IsEmail({}, { message: 'O email informado nao e valido.' })
  @IsNotEmpty({ message: 'O email nao pode estar vazio.' })
  email!: string;

  @ApiProperty({ description: 'Codigo de verificacao recebido por email' })
  @IsString()
  @IsNotEmpty({ message: 'O codigo de verificacao nao pode estar vazio.' })
  code!: string;
}
