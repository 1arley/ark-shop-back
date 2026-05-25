import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token received by email' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'User email' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ description: 'New password', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres' })
  password!: string;
}
