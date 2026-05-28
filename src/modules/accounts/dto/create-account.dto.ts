import { IsEmail, IsString, MinLength, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  productId!: string;

  @ApiProperty({ description: 'Account email' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Account password' })
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiPropertyOptional({ description: 'Additional metadata (recovery email, notes, etc.)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
