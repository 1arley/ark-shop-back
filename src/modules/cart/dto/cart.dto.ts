import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsUUID, Min } from 'class-validator';

export class CartItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class AddToCartDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class UpdateCartItemDto {
  @ApiPropertyOptional({ description: 'Quantity' })
  @IsNumber()
  @Min(1)
  quantity?: number;
}
