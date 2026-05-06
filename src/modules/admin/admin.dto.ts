import { IsString, IsOptional, IsUUID, IsBoolean, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BulkImportKeysDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ description: 'Keys to import (one per line or comma-separated)' })
  @IsString()
  keysText!: string;

  @ApiPropertyOptional({ description: 'Is CSV format' })
  @IsBoolean()
  @IsOptional()
  isCsv?: boolean;
}

export class GenerateDemoDataDto {
  @ApiPropertyOptional({ description: 'Number of products to create', default: 5 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  productsCount?: number = 5;

  @ApiPropertyOptional({ description: 'Number of keys per product', default: 10 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  keysPerProduct?: number = 10;
}
