import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestEmailChangeDto {
  @ApiProperty({ description: 'Novo email do usuario' })
  @IsEmail({}, { message: 'O novo email informado nao e valido.' })
  @IsNotEmpty({ message: 'O novo email nao pode estar vazio.' })
  newEmail!: string;
}
