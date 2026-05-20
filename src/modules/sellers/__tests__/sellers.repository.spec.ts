import { Test, TestingModule } from '@nestjs/testing';
import { SellersRepository } from '../sellers.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('SellersRepository', () => {
  let repository: SellersRepository;
  let prisma: PrismaService;

  const mockPrismaService = {
    seller: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SellersRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<SellersRepository>(SellersRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar seller com valores padrão', async () => {
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
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.seller.create.mockResolvedValue(createdSeller);

      const result = await repository.create(createDto);

      expect(result).toEqual(createdSeller);
      expect(prisma.seller.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          companyName: 'Test Company',
          document: '12345678901',
          commission: 10,
          isActive: true,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });

    it('deve criar seller com todos os campos', async () => {
      const createDto = {
        userId: 'user-1',
        companyName: 'Test Company',
        document: '12345678901',
        commission: 15,
        isActive: false,
      };

      const createdSeller = {
        id: 'seller-1',
        userId: 'user-1',
        companyName: 'Test Company',
        document: '12345678901',
        commission: 15,
        isActive: false,
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.seller.create.mockResolvedValue(createdSeller);

      const result = await repository.create(createDto);

      expect(result).toEqual(createdSeller);
      expect(prisma.seller.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          companyName: 'Test Company',
          document: '12345678901',
          commission: 15,
          isActive: false,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });
  });

  describe('updateAsaasData', () => {
    it('deve atualizar dados da Asaas com sucesso', async () => {
      const existingSeller = {
        id: 'seller-1',
        companyName: 'Test Company',
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      };

      const updatedSeller = {
        ...existingSeller,
        asaasAccountId: 'asaas-123',
        asaasWalletId: 'wallet-456',
        commission: 10,
      };

      mockPrismaService.seller.findUnique.mockResolvedValue(existingSeller);
      mockPrismaService.seller.update.mockResolvedValue(updatedSeller);

      const result = await repository.updateAsaasData('seller-1', {
        asaasAccountId: 'asaas-123',
        asaasWalletId: 'wallet-456',
      });

      expect(result).toEqual(updatedSeller);
      expect(prisma.seller.update).toHaveBeenCalledWith({
        where: { id: 'seller-1' },
        data: {
          asaasAccountId: 'asaas-123',
          asaasWalletId: 'wallet-456',
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    });

    it('deve propagar erro se seller não existir', async () => {
      mockPrismaService.seller.update.mockRejectedValue(new Error('Record not found'));

      await expect(
        repository.updateAsaasData('seller-999', {
          asaasAccountId: 'asaas-123',
          asaasWalletId: 'wallet-456',
        }),
      ).rejects.toThrow('Record not found');
    });
  });

  describe('findAll', () => {
    it('deve listar sellers com paginação', async () => {
      const sellers = [
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
      ];

      mockPrismaService.$transaction.mockResolvedValue([sellers, 2]);

      const result = await repository.findAll(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findById', () => {
    it('deve encontrar seller por ID', async () => {
      const seller = {
        id: 'seller-1',
        companyName: 'Test Company',
        commission: 10,
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com', role: 'USER' },
      };

      mockPrismaService.seller.findUnique.mockResolvedValue(seller);

      const result = await repository.findById('seller-1');

      expect(result).toEqual({ ...seller, commission: 10 });
      expect(prisma.seller.findUnique).toHaveBeenCalledWith({
        where: { id: 'seller-1' },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      });
    });

    it('deve lançar NotFoundException se seller não existir', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue(null);

      await expect(repository.findById('seller-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('deve atualizar seller com sucesso', async () => {
      const existingSeller = {
        id: 'seller-1',
        companyName: 'Old Company',
        commission: 10,
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      };

      const updatedSeller = {
        ...existingSeller,
        companyName: 'New Company',
      };

      mockPrismaService.seller.findUnique.mockResolvedValue(existingSeller);
      mockPrismaService.seller.update.mockResolvedValue(updatedSeller);

      const result = await repository.update('seller-1', { companyName: 'New Company' });

      expect(result).toEqual({ ...updatedSeller, commission: 10 });
      expect(prisma.seller.update).toHaveBeenCalled();
    });

    it('deve propagar erro do Prisma se seller não existir', async () => {
      mockPrismaService.seller.update.mockRejectedValue(new Error('Record to update not found'));

      await expect(repository.update('seller-999', { companyName: 'New' })).rejects.toThrow(
        'Record to update not found',
      );
    });
  });

  describe('delete', () => {
    it('deve deletar seller com sucesso', async () => {
      const existingSeller = {
        id: 'seller-1',
        companyName: 'Test Company',
        user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
      };

      mockPrismaService.seller.findUnique.mockResolvedValue(existingSeller);
      mockPrismaService.seller.delete.mockResolvedValue(existingSeller);

      const result = await repository.delete('seller-1');

      expect(result).toEqual(existingSeller);
      expect(prisma.seller.delete).toHaveBeenCalledWith({ where: { id: 'seller-1' } });
    });

    it('deve propagar erro do Prisma se seller não existir', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue(null);
      mockPrismaService.seller.delete.mockRejectedValue(new Error('Record to delete not found'));

      await expect(repository.delete('seller-999')).rejects.toThrow('Record to delete not found');
    });
  });
});
