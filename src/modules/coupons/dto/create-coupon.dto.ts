import {
  IsString,
  IsEnum,
  IsNumber,
  Min,
  IsOptional,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Coupon type as string literal enum to avoid Prisma client dependency issues
export enum CouponType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export class CreateCouponDto {
  @ApiProperty({ description: 'Coupon code (uppercase, alphanumeric)', example: 'PROMO10' })
  @IsString()
  code!: string;

  @ApiProperty({ enum: CouponType, description: 'Discount type' })
  @IsEnum(CouponType)
  type!: CouponType;

  @ApiProperty({ description: 'Discount value (percentage or fixed amount)', example: 10 })
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({
    description: 'Minimum purchase amount to use this coupon',
    example: 50,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minPurchase?: number;

  @ApiPropertyOptional({ description: 'Maximum number of uses (null = unlimited)', example: 100 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxUses?: number;

  @ApiPropertyOptional({ description: 'Coupon validity start date' })
  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @ApiPropertyOptional({ description: 'Coupon validity end date' })
  @IsDateString()
  @IsOptional()
  validTo?: string;

  @ApiPropertyOptional({ description: 'Is coupon active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
