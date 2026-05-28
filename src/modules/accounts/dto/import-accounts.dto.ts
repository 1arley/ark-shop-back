import { IsString, IsArray, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ImportAccountsDto {
  @ApiProperty({ description: 'Product ID to import accounts into' })
  @IsString()
  productId!: string;

  @ApiProperty({
    description: 'Accounts in format "email:password:jsonMetadata?" one per array entry',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  accounts!: string[];
}
