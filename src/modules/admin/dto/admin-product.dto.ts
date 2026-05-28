import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsBoolean,
  IsUUID,
  IsArray,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ProductType } from '@prisma/client';

const PRODUCT_TYPE_VALUES = {
  KEY: 'KEY',
  ACCOUNT: 'ACCOUNT',
} as const;

export class AdminCreateProductDto {
  @ApiProperty({ description: 'Product name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Product description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Product price' })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ description: 'Product stock quantity' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @ApiPropertyOptional({ description: 'Product category ID' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Product is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Product image URL' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    enum: PRODUCT_TYPE_VALUES,
    description: 'Product type (KEY or ACCOUNT)',
    default: 'KEY',
  })
  @IsEnum(PRODUCT_TYPE_VALUES)
  @IsOptional()
  productType?: ProductType;

  @ApiPropertyOptional({ description: 'Post-purchase instructions for accounts' })
  @IsString()
  @IsOptional()
  instructions?: string;
}

export class AdminUpdateProductDto {
  @ApiPropertyOptional({ description: 'Product name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Product description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Product price' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ description: 'Product stock quantity' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @ApiPropertyOptional({ description: 'Product is active' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Product category ID' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Product image URL' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ enum: PRODUCT_TYPE_VALUES, description: 'Product type (KEY or ACCOUNT)' })
  @IsEnum(PRODUCT_TYPE_VALUES)
  @IsOptional()
  productType?: ProductType;

  @ApiPropertyOptional({ description: 'Post-purchase instructions for accounts' })
  @IsString()
  @IsOptional()
  instructions?: string;
}

export class AddKeysDto {
  @ApiProperty({ description: 'Array of game keys' })
  @IsArray()
  @IsString({ each: true })
  keys!: string[];
}

export class UpdateOrderStatusDto {
  @ApiProperty({ description: 'New order status' })
  @IsString()
  status!: string;
}
