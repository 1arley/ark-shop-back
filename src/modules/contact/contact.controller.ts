import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { ContactDto } from './dto/contact.dto';

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 mensagens/minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enviar mensagem de contato' })
  @ApiResponse({ status: 200, description: 'Mensagem enviada com sucesso.' })
  async send(@Body() dto: ContactDto) {
    return this.contactService.send(dto);
  }
}
