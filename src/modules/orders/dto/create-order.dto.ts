import {
  IsNumber,
  IsArray,
  ValidateNested,
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto], description: 'Order items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @ApiPropertyOptional({ description: 'Coupon code to apply discount' })
  @IsString()
  @IsOptional()
  couponCode?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: [
      'PENDING',
      'AWAITING_PAYMENT',
      'PAID',
      'PROCESSING',
      'DELIVERED',
      'CANCELLED',
      'REFUNDED',
    ],
  })
  @IsEnum([
    'PENDING',
    'AWAITING_PAYMENT',
    'PAID',
    'PROCESSING',
    'DELIVERED',
    'CANCELLED',
    'REFUNDED',
  ])
  status!: string;
}
