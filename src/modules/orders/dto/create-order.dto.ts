import {
  IsNumber,
  IsArray,
  ValidateNested,
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  @Min(1)
  @Max(1)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderItemDto], description: 'Order items' })
  @IsArray()
  @ArrayMinSize(1)
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
