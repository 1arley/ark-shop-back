import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { KeyStatus } from '@prisma/client';

export class UpdateKeyDto {
  @ApiPropertyOptional({ description: 'Key data (will be re-encrypted)' })
  @IsString()
  @IsOptional()
  keyData?: string;

  @ApiPropertyOptional({ description: 'Key status', enum: KeyStatus })
  @IsEnum(KeyStatus)
  @IsOptional()
  status?: KeyStatus;
}
