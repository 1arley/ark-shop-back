import { Test, TestingModule } from '@nestjs/testing';
import { ContactController } from '../contact.controller';
import { ContactService } from '../contact.service';

describe('ContactController', () => {
  let controller: ContactController;
  let service: ContactService;

  const mockContactService = {
    send: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [{ provide: ContactService, useValue: mockContactService }],
    }).compile();

    controller = module.get<ContactController>(ContactController);
    service = module.get<ContactService>(ContactService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('send (público)', () => {
    it('deve enviar mensagem de contato com sucesso', async () => {
      const contactDto = {
        name: 'John Doe',
        email: 'john@example.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough characters.',
      };

      const response = {
        message: 'Mensagem enviada com sucesso. Entraremos em contato em breve.',
      };

      mockContactService.send.mockResolvedValue(response);

      const result = await controller.send(contactDto);

      expect(result).toEqual(response);
      expect(service.send).toHaveBeenCalledWith(contactDto);
    });
  });
});
