import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email do usuario' })
  @IsEmail({}, { message: 'O email informado nao e valido.' })
  @IsNotEmpty({ message: 'O email nao pode estar vazio.' })
  email!: string;

  @ApiProperty({
    description: 'Verification code received by email (6 digits)',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'The verification code cannot be empty.' })
  @Matches(/^\d{6}$/, { message: 'Verification code must be exactly 6 digits.' })
  code!: string;
}
