import { Injectable } from '@nestjs/common';
import { ContactDto } from './dto/contact.dto';

@Injectable()
export class ContactService {
  constructor() {}

  async send(dto: ContactDto) {
    console.log('📬 Contact message received:', {
      name: dto.name,
      email: dto.email,
      subject: dto.subject,
      message: dto.message,
    });

    return {
      message: 'Mensagem enviada com sucesso. Entraremos em contato em breve.',
    };
  }
}
