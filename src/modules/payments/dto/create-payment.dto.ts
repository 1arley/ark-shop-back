import { IsNumber, IsOptional, IsEnum, Min, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider, PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Payment amount', example: 59.99 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({
    description: 'Payment provider',
    enum: PaymentProvider,
    example: PaymentProvider.ASAAS,
  })
  @IsEnum(PaymentProvider)
  @IsOptional()
  provider?: PaymentProvider;

  @ApiPropertyOptional({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.PIX,
    default: PaymentMethod.PIX,
  })
  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Payer CPF (required for PIX)' })
  @IsString()
  @IsOptional()
  payerCpf?: string;

  @ApiPropertyOptional({ description: 'Payer birth date (YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  payerBirthDate?: string;
}
