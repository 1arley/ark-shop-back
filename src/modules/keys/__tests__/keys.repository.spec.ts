import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { KeysRepository } from '../keys.repository';
import { PrismaService } from '@/prisma/prisma.service';
import { KeysEncryptionProvider } from '../keys-encryption.provider';
import { KeyStatus } from '@prisma/client';

describe('KeysRepository', () => {
  let repository: KeysRepository;
  let prisma: PrismaService;
  let encryptionProvider: KeysEncryptionProvider;

  const mockPrismaService = {
    key: {
      create: jest.fn(),
      createMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockEncryptionProvider = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    encryptBatch: jest.fn(),
    decryptBatch: jest.fn(),
    generateSecureKey: jest.fn(),
  };

  const mockKey = {
    id: 'key-id-1',
    productId: 'product-id-1',
    keyData: 'v2:encrypted-data',
    status: KeyStatus.AVAILABLE,
    orderItemId: null,
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    product: { id: 'product-id-1', name: 'Game Key' },
    orderItem: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeysRepository,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: KeysEncryptionProvider, useValue: mockEncryptionProvider },
      ],
    }).compile();

    repository = module.get<KeysRepository>(KeysRepository);
    prisma = module.get<PrismaService>(PrismaService);
    encryptionProvider = module.get<KeysEncryptionProvider>(KeysEncryptionProvider);

    jest.clearAllMocks();
  });

  // ─── create ───────────────────────────────────────────────────────
  describe('create', () => {
    it('deve criptografar chave e criar com status AVAILABLE', async () => {
      mockEncryptionProvider.encrypt.mockReturnValue('v2:encrypted-data');
      mockPrismaService.key.create.mockResolvedValue(mockKey);

      const result = await repository.create('product-id-1', 'raw-key-data');

      expect(encryptionProvider.encrypt).toHaveBeenCalledWith('raw-key-data');
      expect(prisma.key.create).toHaveBeenCalledWith({
        data: {
          productId: 'product-id-1',
          keyData: 'v2:encrypted-data',
          status: KeyStatus.AVAILABLE,
        },
        include: { product: true },
      });
      expect(result).toEqual(mockKey);
    });
  });

  // ─── createBatch ──────────────────────────────────────────────────
  describe('createBatch', () => {
    it('deve importar multiplos chaves com sucesso', async () => {
      const keys = ['key-1', 'key-2', 'key-3'];
      mockEncryptionProvider.encrypt
        .mockReturnValueOnce('v2:encrypted-1')
        .mockReturnValueOnce('v2:encrypted-2')
        .mockReturnValueOnce('v2:encrypted-3');
      mockPrismaService.key.createMany.mockResolvedValue({ count: 3 });

      const result = await repository.createBatch('product-id-1', keys);

      expect(encryptionProvider.encrypt).toHaveBeenCalledTimes(3);
      expect(prisma.key.createMany).toHaveBeenCalledWith({
        data: [
          { productId: 'product-id-1', keyData: 'v2:encrypted-1', status: KeyStatus.AVAILABLE },
          { productId: 'product-id-1', keyData: 'v2:encrypted-2', status: KeyStatus.AVAILABLE },
          { productId: 'product-id-1', keyData: 'v2:encrypted-3', status: KeyStatus.AVAILABLE },
        ],
        skipDuplicates: true,
      });
      expect(result.imported).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('deve contabilizar falhas de criptografia', async () => {
      const keys = ['key-1', 'bad-key', 'key-3'];
      mockEncryptionProvider.encrypt
        .mockReturnValueOnce('v2:encrypted-1')
        .mockImplementationOnce(() => {
          throw new Error('Encryption failed');
        })
        .mockReturnValueOnce('v2:encrypted-3');

      mockPrismaService.key.createMany.mockResolvedValue({ count: 2 });

      const result = await repository.createBatch('product-id-1', keys);

      expect(result.imported).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Failed to encrypt key: Encryption failed');
    });

    it('deve usar fallback createMany quando createMany falha', async () => {
      const keys = ['key-1', 'key-2'];
      mockEncryptionProvider.encrypt
        .mockReturnValueOnce('v2:encrypted-1')
        .mockReturnValueOnce('v2:encrypted-2');
      mockPrismaService.key.createMany.mockRejectedValue(new Error('Too many params'));
      mockPrismaService.key.create.mockResolvedValue(mockKey);

      const result = await repository.createBatch('product-id-1', keys);

      expect(prisma.key.createMany).toHaveBeenCalled();
      expect(prisma.key.create).toHaveBeenCalledTimes(2);
      expect(result.imported).toBe(2);
    });

    it('deve retornar resultado vazio quando todas criptografias falham', async () => {
      const keys = ['bad-key-1', 'bad-key-2'];
      mockEncryptionProvider.encrypt.mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      const result = await repository.createBatch('product-id-1', keys);

      expect(result.imported).toBe(0);
      expect(result.failed).toBe(2);
      expect(prisma.key.createMany).not.toHaveBeenCalled();
    });
  });

  // ─── findById ─────────────────────────────────────────────────────
  describe('findById', () => {
    it('deve retornar chave quando encontrada', async () => {
      mockPrismaService.key.findUnique.mockResolvedValue(mockKey);

      const result = await repository.findById('key-id-1');

      expect(prisma.key.findUnique).toHaveBeenCalledWith({
        where: { id: 'key-id-1' },
        include: { product: true, orderItem: true },
      });
      expect(result).toEqual(mockKey);
    });

    it('deve lancar NotFoundException quando chave nao existe', async () => {
      mockPrismaService.key.findUnique.mockResolvedValue(null);

      await expect(repository.findById('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(repository.findById('nonexistent')).rejects.toThrow(
        'Key with ID nonexistent not found',
      );
    });
  });

  // ─── findByProduct ────────────────────────────────────────────────
  describe('findByProduct', () => {
    it('deve retornar chaves do produto com paginacao padrao', async () => {
      const keys = [mockKey];
      mockPrismaService.$transaction.mockResolvedValue([keys, 1]);

      const result = await repository.findByProduct('product-id-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.data).toEqual(keys);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });
    });

    it('deve retornar chaves com paginacao customizada', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 25]);

      const result = await repository.findByProduct('product-id-1', 2, 10);

      expect(result.meta).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
    });

    it('deve retornar lista vazia quando produto nao tem chaves', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      const result = await repository.findByProduct('product-id-1');

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  // ─── findAvailableKey ─────────────────────────────────────────────
  describe('findAvailableKey', () => {
    it('deve retornar chave disponivel do produto', async () => {
      mockPrismaService.key.findFirst.mockResolvedValue(mockKey);

      const result = await repository.findAvailableKey('product-id-1');

      expect(prisma.key.findFirst).toHaveBeenCalledWith({
        where: {
          productId: 'product-id-1',
          status: KeyStatus.AVAILABLE,
        },
      });
      expect(result).toEqual(mockKey);
    });

    it('deve retornar null quando nao ha chave disponivel', async () => {
      mockPrismaService.key.findFirst.mockResolvedValue(null);

      const result = await repository.findAvailableKey('product-id-1');

      expect(result).toBeNull();
    });
  });

  // ─── reserveKey ───────────────────────────────────────────────────
  describe('reserveKey', () => {
    it('deve reservar chave com sucesso', async () => {
      const reservedKey = { ...mockKey, status: KeyStatus.RESERVED, orderItemId: 'item-id-1' };
      mockPrismaService.key.findUnique.mockResolvedValue(mockKey);
      mockPrismaService.key.update.mockResolvedValue(reservedKey);

      const result = await repository.reserveKey('key-id-1', 'item-id-1');

      expect(prisma.key.findUnique).toHaveBeenCalledWith({ where: { id: 'key-id-1' } });
      expect(prisma.key.update).toHaveBeenCalledWith({
        where: { id: 'key-id-1' },
        data: {
          status: KeyStatus.RESERVED,
          orderItemId: 'item-id-1',
        },
      });
      expect(result).toEqual(reservedKey);
    });

    it('deve lancar NotFoundException quando chave nao existe', async () => {
      mockPrismaService.key.findUnique.mockResolvedValue(null);

      await expect(repository.reserveKey('nonexistent', 'item-id-1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(repository.reserveKey('nonexistent', 'item-id-1')).rejects.toThrow(
        'Key with ID nonexistent not found',
      );
      expect(prisma.key.update).not.toHaveBeenCalled();
    });

    it('deve lancar BadRequestException quando chave nao esta disponivel', async () => {
      const reservedKey = { ...mockKey, status: KeyStatus.RESERVED };
      mockPrismaService.key.findUnique.mockResolvedValue(reservedKey);

      await expect(repository.reserveKey('key-id-1', 'item-id-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(repository.reserveKey('key-id-1', 'item-id-1')).rejects.toThrow(
        'Key is not available (current status: RESERVED)',
      );
    });

    it('deve lancar BadRequestException quando chave esta DELIVERED', async () => {
      const deliveredKey = { ...mockKey, status: KeyStatus.DELIVERED };
      mockPrismaService.key.findUnique.mockResolvedValue(deliveredKey);

      await expect(repository.reserveKey('key-id-1', 'item-id-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── reserveAvailableKeyAtomic ────────────────────────────────────
  describe('reserveAvailableKeyAtomic', () => {
    it('deve reservar chave atomicamente com sucesso', async () => {
      const availableKey = { id: 'key-id-1', status: KeyStatus.AVAILABLE };
      const reservedKey = { ...availableKey, status: KeyStatus.RESERVED, orderItemId: 'item-id-1' };
      const mockTx = {
        key: {
          findFirst: jest.fn().mockResolvedValue(availableKey),
          update: jest.fn().mockResolvedValue(reservedKey),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async cb => cb(mockTx));

      const result = await repository.reserveAvailableKeyAtomic('product-id-1', 'item-id-1');

      expect(mockTx.key.findFirst).toHaveBeenCalledWith({
        where: {
          productId: 'product-id-1',
          status: KeyStatus.AVAILABLE,
        },
      });
      expect(mockTx.key.update).toHaveBeenCalledWith({
        where: { id: 'key-id-1' },
        data: {
          status: KeyStatus.RESERVED,
          orderItemId: 'item-id-1',
        },
      });
      expect(result).toEqual(reservedKey);
    });

    it('deve lancar BadRequestException quando nao ha chaves disponiveis', async () => {
      const mockTx = {
        key: {
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async cb => cb(mockTx));

      await expect(
        repository.reserveAvailableKeyAtomic('product-id-1', 'item-id-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        repository.reserveAvailableKeyAtomic('product-id-1', 'item-id-1'),
      ).rejects.toThrow('No available keys for product product-id-1');
    });
  });

  // ─── deliverKey ───────────────────────────────────────────────────
  describe('deliverKey', () => {
    it('deve marcar chave como entregue', async () => {
      const deliveredKey = {
        ...mockKey,
        status: KeyStatus.DELIVERED,
        deliveredAt: new Date(),
      };
      mockPrismaService.key.update.mockResolvedValue(deliveredKey);

      const result = await repository.deliverKey('key-id-1');

      expect(prisma.key.update).toHaveBeenCalledWith({
        where: { id: 'key-id-1' },
        data: {
          status: KeyStatus.DELIVERED,
          deliveredAt: expect.any(Date),
        },
      });
      expect(result.status).toBe(KeyStatus.DELIVERED);
      expect(result.deliveredAt).toBeDefined();
    });
  });

  // ─── getKeyData ───────────────────────────────────────────────────
  describe('getKeyData', () => {
    it('deve retornar dados da chave descriptografados', async () => {
      mockPrismaService.key.findUnique.mockResolvedValue(mockKey);
      mockEncryptionProvider.decrypt.mockReturnValue('XXXX-YYYY-ZZZZ');

      const result = await repository.getKeyData('key-id-1');

      expect(encryptionProvider.decrypt).toHaveBeenCalledWith('v2:encrypted-data');
      expect(result).toBe('XXXX-YYYY-ZZZZ');
    });
  });

  // ─── countByProduct ───────────────────────────────────────────────
  describe('countByProduct', () => {
    it('deve retornar contagem de todos os status', async () => {
      mockPrismaService.key.count
        .mockResolvedValueOnce(10) // available
        .mockResolvedValueOnce(5) // reserved
        .mockResolvedValueOnce(20); // delivered

      const result = await repository.countByProduct('product-id-1');

      expect(prisma.key.count).toHaveBeenCalledTimes(3);
      expect(prisma.key.count).toHaveBeenCalledWith({
        where: { productId: 'product-id-1', status: KeyStatus.AVAILABLE },
      });
      expect(prisma.key.count).toHaveBeenCalledWith({
        where: { productId: 'product-id-1', status: KeyStatus.RESERVED },
      });
      expect(prisma.key.count).toHaveBeenCalledWith({
        where: { productId: 'product-id-1', status: KeyStatus.DELIVERED },
      });
      expect(result).toEqual({
        available: 10,
        reserved: 5,
        delivered: 20,
        total: 35,
      });
    });

    it('deve retornar zeros quando produto nao tem chaves', async () => {
      mockPrismaService.key.count.mockResolvedValue(0);

      const result = await repository.countByProduct('product-id-1');

      expect(result).toEqual({
        available: 0,
        reserved: 0,
        delivered: 0,
        total: 0,
      });
    });
  });

  // ─── update ───────────────────────────────────────────────────────
  describe('update', () => {
    it('deve atualizar status da chave', async () => {
      const updatedKey = { ...mockKey, status: KeyStatus.RESERVED };
      mockPrismaService.key.findUnique.mockResolvedValue(mockKey);
      mockPrismaService.key.update.mockResolvedValue(updatedKey);

      const result = await repository.update('key-id-1', { status: KeyStatus.RESERVED });

      expect(prisma.key.update).toHaveBeenCalledWith({
        where: { id: 'key-id-1' },
        data: { status: KeyStatus.RESERVED },
        include: { product: true },
      });
      expect(result.status).toBe(KeyStatus.RESERVED);
    });

    it('deve atualizar keyData da chave com criptografia', async () => {
      const updatedKey = { ...mockKey, keyData: 'v2:new-encrypted-data' };
      mockPrismaService.key.findUnique.mockResolvedValue(mockKey);
      mockEncryptionProvider.encrypt.mockReturnValue('v2:new-encrypted-data');
      mockPrismaService.key.update.mockResolvedValue(updatedKey);

      const result = await repository.update('key-id-1', { keyData: 'new-raw-key' });

      expect(encryptionProvider.encrypt).toHaveBeenCalledWith('new-raw-key');
      expect(prisma.key.update).toHaveBeenCalledWith({
        where: { id: 'key-id-1' },
        data: { keyData: 'v2:new-encrypted-data' },
        include: { product: true },
      });
      expect(result.keyData).toBe('v2:new-encrypted-data');
    });

    it('deve lancar NotFoundException quando chave nao existe', async () => {
      mockPrismaService.key.findUnique.mockResolvedValue(null);

      await expect(
        repository.update('nonexistent', { status: KeyStatus.RESERVED }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.key.update).not.toHaveBeenCalled();
    });
  });

  // ─── delete ───────────────────────────────────────────────────────
  describe('delete', () => {
    it('deve deletar chave disponivel com sucesso', async () => {
      mockPrismaService.key.findUnique.mockResolvedValue(mockKey);
      mockPrismaService.key.delete.mockResolvedValue(mockKey);

      const result = await repository.delete('key-id-1');

      expect(prisma.key.findUnique).toHaveBeenCalledWith({ where: { id: 'key-id-1' } });
      expect(prisma.key.delete).toHaveBeenCalledWith({ where: { id: 'key-id-1' } });
      expect(result).toEqual(mockKey);
    });

    it('deve lancar BadRequestException quando chave nao esta disponivel', async () => {
      const reservedKey = { ...mockKey, status: KeyStatus.RESERVED };
      mockPrismaService.key.findUnique.mockResolvedValue(reservedKey);

      await expect(repository.delete('key-id-1')).rejects.toThrow(BadRequestException);
      await expect(repository.delete('key-id-1')).rejects.toThrow('Can only delete available keys');
      expect(prisma.key.delete).not.toHaveBeenCalled();
    });

    it('deve lancar BadRequestException quando chave esta DELIVERED', async () => {
      const deliveredKey = { ...mockKey, status: KeyStatus.DELIVERED };
      mockPrismaService.key.findUnique.mockResolvedValue(deliveredKey);

      await expect(repository.delete('key-id-1')).rejects.toThrow(BadRequestException);
    });

    it('deve lancar NotFoundException quando chave nao existe', async () => {
      mockPrismaService.key.findUnique.mockResolvedValue(null);

      await expect(repository.delete('nonexistent')).rejects.toThrow(NotFoundException);
      await expect(repository.delete('nonexistent')).rejects.toThrow(
        'Key with ID nonexistent not found',
      );
      expect(prisma.key.delete).not.toHaveBeenCalled();
    });
  });
});
