import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsEnum,
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
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ type: [OrderItemDto], description: 'Order items' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
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
