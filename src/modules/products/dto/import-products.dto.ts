import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class ImportProductsDto {
  @ApiProperty({
    description: 'CSV content with product data (required when not uploading a file)',
    example: `XBOX,STEAM/PC,NINTENDO E-SHOP
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025 15:01:53,Final fantasy xvi(xbox-europa),R$200,00`,
    required: false,
  })
  @IsString()
  @IsOptional()
  csvContent?: string;

  @ApiPropertyOptional({
    description: 'Category ID to associate all imported products',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Whether imported products should be active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
