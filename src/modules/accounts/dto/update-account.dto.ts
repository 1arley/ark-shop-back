import { IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { KeyStatus } from '@prisma/client';

export class UpdateAccountDto {
  @ApiPropertyOptional({ description: 'Account email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Account password' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'Account status', enum: KeyStatus })
  @IsOptional()
  @IsEnum(KeyStatus)
  status?: KeyStatus;

  @ApiPropertyOptional({ description: 'Additional metadata (JSON object)' })
  @IsOptional()
  @IsString()
  metadata?: string;
}
