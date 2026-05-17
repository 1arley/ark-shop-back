import { IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyCouponDto {
  @ApiProperty({ description: 'Coupon code to apply', example: 'PROMO10' })
  @IsString()
  code!: string;

  @ApiProperty({ description: 'Cart subtotal amount to validate minimum purchase', example: 100 })
  @IsNumber()
  @Min(0)
  subtotal!: number;
}
