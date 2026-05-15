import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ImportProductsDto {
  @ApiProperty({
    description: 'CSV content with product data',
    example: `XBOX,STEAM/PC,NINTENDO E-SHOP
Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025 15:01:53,Final fantasy xvi(xbox-europa),R$200,00`,
  })
  @IsString()
  csvContent!: string;
}
