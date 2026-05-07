import { IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider, PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Payment amount', example: 59.99 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({
    description: 'Payment provider',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    enum: PaymentProvider,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    example: PaymentProvider.MERCADO_PAGO,
  })
  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider;

  @ApiPropertyOptional({
    description: 'Payment method',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    enum: PaymentMethod,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    example: PaymentMethod.PIX,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    default: PaymentMethod.PIX,
  })
  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;
}
