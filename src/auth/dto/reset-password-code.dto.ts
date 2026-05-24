import { IsEmail, IsNotEmpty, IsString, MinLength, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordWithCodeDto {
  @ApiProperty({ description: 'Email do usuario' })
  @IsEmail({}, { message: 'O email informado nao e valido.' })
  @IsNotEmpty({ message: 'O email nao pode estar vazio.' })
  email!: string;

  @ApiProperty({
    description: 'Reset code received by email (6 digits)',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'The code cannot be empty.' })
  @Matches(/^\d{6}$/, { message: 'Code must be exactly 6 digits.' })
  code!: string;

  @ApiProperty({
    description: 'New password with complexity requirements',
    example: 'Str0ng!Pass',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty({ message: 'The password cannot be empty.' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  @Matches(/[^A-Za-z0-9]/, { message: 'Password must contain at least one special character' })
  password!: string;
}
