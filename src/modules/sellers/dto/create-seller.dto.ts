import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSellerDto {
  @ApiProperty({ description: 'User ID to associate with seller' })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ description: 'Company name' })
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @ApiProperty({ description: 'Document (CPF/CNPJ)' })
  @IsString()
  @IsNotEmpty()
  document!: string;

  @ApiPropertyOptional({ description: 'Commission percentage', default: 10 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  commission?: number;

  @ApiPropertyOptional({ description: 'Is seller active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSellerDto {
  @ApiPropertyOptional({ description: 'Company name' })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional({ description: 'Document (CPF/CNPJ)' })
  @IsString()
  @IsOptional()
  document?: string;

  @ApiPropertyOptional({ description: 'Commission percentage' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  commission?: number;

  @ApiPropertyOptional({ description: 'Is seller active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
