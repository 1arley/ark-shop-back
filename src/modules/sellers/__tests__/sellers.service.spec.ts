import { Test, TestingModule } from '@nestjs/testing';
import { SellersService } from '../sellers.service';
import { SellersRepository } from '../sellers.repository';
import { UserService } from '@/user/user.service';
import { AsaasProvider } from '@/modules/payments/providers/asaas.provider';
import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('SellersService', () => {
  let service: SellersService;
  let repository: SellersRepository;
  let asaasProvider: AsaasProvider;

  const mockSellersRepository = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    updateAsaasData: jest.fn(),
  };

  const mockUserService = {
    findById: jest.fn(),
  };

  const mockAsaasProvider = {
    createSubAccount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SellersService,
        { provide: SellersRepository, useValue: mockSellersRepository },
        { provide: UserService, useValue: mockUserService },
        { provide: AsaasProvider, useValue: mockAsaasProvider },
      ],
    }).compile();

    service = module.get<SellersService>(SellersService);
    repository = module.get<SellersRepository>(SellersRepository);
    asaasProvider = module.get<AsaasProvider>(AsaasProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      userId: 'user-1',
      companyName: 'Test Company',
      document: '12345678901',
      commission: 10,
      isActive: true,
    };

    it('deve criar seller com sucesso e integrar com Asaas', async () => {
      const user = { id: 'user-1', name: 'Test User', email: 'test@example.com', role: Role.USER };
      const createdSeller = {
        id: 'seller-1',
        userId: 'user-1',
        companyName: 'Test Company',
        document: '12345678901',
        commission: 10,
        isActive: true,
        asaasAccountId: null,
        asaasWalletId: null,
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const asaasResult = { id: 'asaas-123', walletId: 'wallet-456' };

      mockUserService.findById.mockResolvedValue(user);
      mockSellersRepository.create.mockResolvedValue(createdSeller);
      mockAsaasProvider.createSubAccount.mockResolvedValue(asaasResult);
      mockSellersRepository.updateAsaasData.mockResolvedValue({
        ...createdSeller,
        asaasAccountId: 'asaas-123',
        asaasWalletId: 'wallet-456',
      });

      const result = await service.create(createDto);

      expect(result).toEqual(createdSeller);
      expect(repository.create).toHaveBeenCalledWith(createDto);
      expect(asaasProvider.createSubAccount).toHaveBeenCalledWith({
        name: 'Test Company',
        email: 'test@example.com',
        cpfCnpj: '12345678901',
        companyType: undefined,
      });
      expect(repository.updateAsaasData).toHaveBeenCalledWith('seller-1', {
        asaasAccountId: 'asaas-123',
        asaasWalletId: 'wallet-456',
      });
    });

    it('deve criar seller mesmo se Asaas falhar (non-blocking)', async () => {
      const user = { id: 'user-1', name: 'Test User', email: 'test@example.com', role: Role.USER };
      const createdSeller = {
        id: 'seller-1',
        userId: 'user-1',
        companyName: 'Test Company',
        document: '12345678901',
        commission: 10,
        isActive: true,
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserService.findById.mockResolvedValue(user);
      mockSellersRepository.create.mockResolvedValue(createdSeller);
      mockAsaasProvider.createSubAccount.mockRejectedValue(new Error('Asaas API error'));

      const result = await service.create(createDto);

      expect(result).toEqual(createdSeller);
      expect(repository.create).toHaveBeenCalledWith(createDto);
      expect(asaasProvider.createSubAccount).toHaveBeenCalled();
      // Não deve lançar erro
    });

    it('deve usar companyType MEI para documento CNPJ (mais de 11 caracteres)', async () => {
      const user = { id: 'user-1', name: 'Test User', email: 'test@example.com', role: Role.USER };
      const createdSeller = {
        id: 'seller-1',
        userId: 'user-1',
        companyName: 'Test Company',
        document: '12345678000195',
        commission: 10,
        isActive: true,
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserService.findById.mockResolvedValue(user);
      mockSellersRepository.create.mockResolvedValue(createdSeller);
      mockAsaasProvider.createSubAccount.mockResolvedValue({
        id: 'asaas-123',
        walletId: 'wallet-456',
      });

      await service.create({ ...createDto, document: '12345678000195' });

      expect(asaasProvider.createSubAccount).toHaveBeenCalledWith({
        name: 'Test Company',
        email: 'test@example.com',
        cpfCnpj: '12345678000195',
        companyType: 'MEI',
      });
    });
  });

  describe('findAll', () => {
    it('deve listar sellers com paginação', async () => {
      const paginatedResult = {
        data: [
          {
            id: '1',
            companyName: 'Company 1',
            user: { id: 'u1', name: 'User 1', email: 'u1@test.com' },
          },
          {
            id: '2',
            companyName: 'Company 2',
            user: { id: 'u2', name: 'User 2', email: 'u2@test.com' },
          },
        ],
        meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
      };

      mockSellersRepository.findAll.mockResolvedValue(paginatedResult);

      const result = await service.findAll(1, 10);

      expect(result).toEqual(paginatedResult);
      expect(repository.findAll).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('findOne', () => {
    it('deve encontrar seller por ID', async () => {
      const seller = {
        id: 'seller-1',
        companyName: 'Test Company',
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com', role: Role.USER },
      };

      mockSellersRepository.findById.mockResolvedValue(seller);

      const result = await service.findOne('seller-1');

      expect(result).toEqual(seller);
      expect(repository.findById).toHaveBeenCalledWith('seller-1');
    });

    it('deve lançar NotFoundException se seller não existir', async () => {
      mockSellersRepository.findById.mockRejectedValue(
        new NotFoundException('Seller não encontrado.'),
      );

      await expect(service.findOne('seller-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('deve atualizar seller com sucesso', async () => {
      const updateDto = { companyName: 'Updated Company' };
      const updatedSeller = {
        id: 'seller-1',
        companyName: 'Updated Company',
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      };

      mockSellersRepository.update.mockResolvedValue(updatedSeller);

      const result = await service.update('seller-1', updateDto);

      expect(result).toEqual(updatedSeller);
      expect(repository.update).toHaveBeenCalledWith('seller-1', updateDto);
    });
  });

  describe('delete', () => {
    it('deve deletar seller com sucesso', async () => {
      mockSellersRepository.delete.mockResolvedValue({ id: 'seller-1' });

      const result = await service.delete('seller-1');

      expect(result).toEqual({ id: 'seller-1' });
      expect(repository.delete).toHaveBeenCalledWith('seller-1');
    });
  });
});
