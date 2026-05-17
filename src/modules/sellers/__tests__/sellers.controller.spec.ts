import { Test, TestingModule } from '@nestjs/testing';
import { SellersController } from '../sellers.controller';
import { SellersService } from '../sellers.service';
import { NotFoundException } from '@nestjs/common';

describe('SellersController', () => {
  let controller: SellersController;
  let service: SellersService;

  const mockSellersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SellersController],
      providers: [{ provide: SellersService, useValue: mockSellersService }],
    }).compile();

    controller = module.get<SellersController>(SellersController);
    service = module.get<SellersService>(SellersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create (admin only)', () => {
    it('deve criar seller', async () => {
      const createDto = {
        userId: 'user-1',
        companyName: 'Test Company',
        document: '12345678901',
      };

      const createdSeller = {
        id: 'seller-1',
        userId: 'user-1',
        companyName: 'Test Company',
        document: '12345678901',
        commission: 10,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSellersService.create.mockResolvedValue(createdSeller);

      const result = await controller.create(createDto);

      expect(result).toEqual(createdSeller);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll (admin only)', () => {
    it('deve listar sellers com paginação', async () => {
      const paginatedResult = {
        data: [
          {
            id: '1',
            companyName: 'Company 1',
            user: { id: 'u1', name: 'User 1', email: 'u1@test.com' },
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      };

      mockSellersService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(1, 20);

      expect(result).toEqual(paginatedResult);
      expect(service.findAll).toHaveBeenCalledWith(1, 20);
    });

    it('deve usar valores padrão para paginação', async () => {
      mockSellersService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      // When called directly (without NestJS pipes), undefined is passed through.
      // The DefaultValuePipe transforms undefined to defaults at runtime.
      await controller.findAll(1, 20);

      expect(service.findAll).toHaveBeenCalledWith(1, 20);
    });
  });

  describe('findOne (admin only)', () => {
    it('deve buscar seller por ID', async () => {
      const seller = {
        id: 'seller-1',
        companyName: 'Test Company',
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com', role: 'USER' },
      };

      mockSellersService.findOne.mockResolvedValue(seller);

      const result = await controller.findOne('seller-1');

      expect(result).toEqual(seller);
      expect(service.findOne).toHaveBeenCalledWith('seller-1');
    });

    it('deve lançar NotFoundException se seller não existir', async () => {
      mockSellersService.findOne.mockRejectedValue(new NotFoundException('Seller não encontrado.'));

      await expect(controller.findOne('seller-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update (admin only)', () => {
    it('deve atualizar seller', async () => {
      const updateDto = { companyName: 'Updated Company' };
      const updatedSeller = {
        id: 'seller-1',
        companyName: 'Updated Company',
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      };

      mockSellersService.update.mockResolvedValue(updatedSeller);

      const result = await controller.update('seller-1', updateDto);

      expect(result).toEqual(updatedSeller);
      expect(service.update).toHaveBeenCalledWith('seller-1', updateDto);
    });
  });

  describe('delete (admin only)', () => {
    it('deve deletar seller', async () => {
      mockSellersService.delete.mockResolvedValue({ id: 'seller-1' });

      const result = await controller.remove('seller-1');

      expect(result).toEqual({ id: 'seller-1' });
      expect(service.delete).toHaveBeenCalledWith('seller-1');
    });
  });
});
