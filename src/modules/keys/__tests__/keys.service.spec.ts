import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { KeysService } from '../keys.service';
import { KeysRepository } from '../keys.repository';
import { KeysEncryptionProvider } from '../keys-encryption.provider';
import { KeyStatus } from '@prisma/client';

describe('KeysService', () => {
  let service: KeysService;
  let keysRepository: KeysRepository;
  let encryptionProvider: KeysEncryptionProvider;

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

  const mockKeysRepository = {
    create: jest.fn(),
    createBatch: jest.fn(),
    findById: jest.fn(),
    findByProduct: jest.fn(),
    findAvailableKey: jest.fn(),
    reserveKey: jest.fn(),
    reserveAvailableKeyAtomic: jest.fn(),
    deliverKey: jest.fn(),
    getKeyData: jest.fn(),
    countByProduct: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockEncryptionProvider = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    encryptBatch: jest.fn(),
    decryptBatch: jest.fn(),
    generateSecureKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeysService,
        { provide: KeysRepository, useValue: mockKeysRepository },
        { provide: KeysEncryptionProvider, useValue: mockEncryptionProvider },
      ],
    }).compile();

    service = module.get<KeysService>(KeysService);
    keysRepository = module.get<KeysRepository>(KeysRepository);
    encryptionProvider = module.get<KeysEncryptionProvider>(KeysEncryptionProvider);

    jest.clearAllMocks();
  });

  // ─── importKeys ───────────────────────────────────────────────────
  describe('importKeys', () => {
    it('deve importar chaves com sucesso', async () => {
      const keys = ['key-1', 'key-2', 'key-3'];
      const result = { imported: 3, failed: 0, errors: [] };

      mockKeysRepository.createBatch.mockResolvedValue(result);

      const importResult = await service.importKeys('product-id-1', keys);

      expect(keysRepository.createBatch).toHaveBeenCalledWith('product-id-1', keys);
      expect(importResult).toEqual(result);
    });

    it('deve lancar BadRequestException quando array de chaves esta vazio', async () => {
      await expect(service.importKeys('product-id-1', [])).rejects.toThrow(BadRequestException);
      await expect(service.importKeys('product-id-1', [])).rejects.toThrow(
        'Keys array cannot be empty',
      );
      expect(keysRepository.createBatch).not.toHaveBeenCalled();
    });
  });

  // ─── getKey ───────────────────────────────────────────────────────
  describe('getKey', () => {
    it('deve retornar chave pelo ID', async () => {
      mockKeysRepository.findById.mockResolvedValue(mockKey);

      const result = await service.getKey('key-id-1');

      expect(keysRepository.findById).toHaveBeenCalledWith('key-id-1');
      expect(result).toEqual(mockKey);
    });
  });

  // ─── getAvailableKey ──────────────────────────────────────────────
  describe('getAvailableKey', () => {
    it('deve retornar chave disponivel do produto', async () => {
      mockKeysRepository.findAvailableKey.mockResolvedValue(mockKey);

      const result = await service.getAvailableKey('product-id-1');

      expect(keysRepository.findAvailableKey).toHaveBeenCalledWith('product-id-1');
      expect(result).toEqual(mockKey);
    });

    it('deve retornar null quando nao ha chave disponivel', async () => {
      mockKeysRepository.findAvailableKey.mockResolvedValue(null);

      const result = await service.getAvailableKey('product-id-1');

      expect(result).toBeNull();
    });
  });

  // ─── reserveKeyForOrder ───────────────────────────────────────────
  describe('reserveKeyForOrder', () => {
    it('deve reservar chave para item do pedido', async () => {
      const reservedKey = { ...mockKey, status: KeyStatus.RESERVED, orderItemId: 'item-id-1' };
      mockKeysRepository.reserveKey.mockResolvedValue(reservedKey);

      const result = await service.reserveKeyForOrder('key-id-1', 'item-id-1');

      expect(keysRepository.reserveKey).toHaveBeenCalledWith('key-id-1', 'item-id-1');
      expect(result).toEqual(reservedKey);
    });
  });

  // ─── deliverKey ───────────────────────────────────────────────────
  describe('deliverKey', () => {
    it('deve entregar chave e retornar com dados descriptografados', async () => {
      const deliveredKey = {
        ...mockKey,
        status: KeyStatus.DELIVERED,
        deliveredAt: new Date(),
      };
      mockKeysRepository.deliverKey.mockResolvedValue(deliveredKey);
      mockKeysRepository.getKeyData.mockResolvedValue('XXXX-YYYY-ZZZZ');

      const result = await service.deliverKey('key-id-1');

      expect(keysRepository.deliverKey).toHaveBeenCalledWith('key-id-1');
      expect(keysRepository.getKeyData).toHaveBeenCalledWith('key-id-1');
      expect(result.decryptedKey).toBe('XXXX-YYYY-ZZZZ');
      expect(result.status).toBe(KeyStatus.DELIVERED);
    });
  });

  // ─── getDecryptedKey ──────────────────────────────────────────────
  describe('getDecryptedKey', () => {
    it('deve retornar chave descriptografada sem alterar status', async () => {
      mockKeysRepository.getKeyData.mockResolvedValue('XXXX-YYYY-ZZZZ');

      const result = await service.getDecryptedKey('key-id-1');

      expect(keysRepository.getKeyData).toHaveBeenCalledWith('key-id-1');
      expect(result).toBe('XXXX-YYYY-ZZZZ');
    });
  });

  // ─── getProductKeys ───────────────────────────────────────────────
  describe('getProductKeys', () => {
    it('deve retornar chaves do produto com paginacao padrao', async () => {
      const paginatedResult = {
        data: [mockKey],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
      };
      mockKeysRepository.findByProduct.mockResolvedValue(paginatedResult);

      const result = await service.getProductKeys('product-id-1');

      expect(keysRepository.findByProduct).toHaveBeenCalledWith('product-id-1', 1, 50);
      expect(result).toEqual(paginatedResult);
    });

    it('deve retornar chaves com paginacao customizada', async () => {
      const paginatedResult = {
        data: [],
        meta: { total: 0, page: 2, limit: 10, totalPages: 0 },
      };
      mockKeysRepository.findByProduct.mockResolvedValue(paginatedResult);

      const result = await service.getProductKeys('product-id-1', 2, 10);

      expect(keysRepository.findByProduct).toHaveBeenCalledWith('product-id-1', 2, 10);
      expect(result).toEqual(paginatedResult);
    });
  });

  // ─── getKeyStats ──────────────────────────────────────────────────
  describe('getKeyStats', () => {
    it('deve retornar contagem de chaves por status', async () => {
      const stats = {
        available: 10,
        reserved: 5,
        delivered: 20,
        total: 35,
      };
      mockKeysRepository.countByProduct.mockResolvedValue(stats);

      const result = await service.getKeyStats('product-id-1');

      expect(keysRepository.countByProduct).toHaveBeenCalledWith('product-id-1');
      expect(result).toEqual(stats);
    });
  });

  // ─── updateKey ────────────────────────────────────────────────────
  describe('updateKey', () => {
    it('deve atualizar status da chave', async () => {
      const updatedKey = { ...mockKey, status: KeyStatus.RESERVED };
      mockKeysRepository.update.mockResolvedValue(updatedKey);

      const result = await service.updateKey('key-id-1', { status: KeyStatus.RESERVED });

      expect(keysRepository.update).toHaveBeenCalledWith('key-id-1', {
        status: KeyStatus.RESERVED,
      });
      expect(result.status).toBe(KeyStatus.RESERVED);
    });

    it('deve atualizar keyData da chave', async () => {
      const updatedKey = { ...mockKey, keyData: 'v2:new-encrypted-data' };
      mockKeysRepository.update.mockResolvedValue(updatedKey);

      const result = await service.updateKey('key-id-1', { keyData: 'new-key-data' });

      expect(keysRepository.update).toHaveBeenCalledWith('key-id-1', {
        keyData: 'new-key-data',
      });
      expect(result.keyData).toBe('v2:new-encrypted-data');
    });

    it('deve atualizar status e keyData simultaneamente', async () => {
      const updatedKey = {
        ...mockKey,
        status: KeyStatus.DELIVERED,
        keyData: 'v2:new-encrypted-data',
      };
      mockKeysRepository.update.mockResolvedValue(updatedKey);

      const result = await service.updateKey('key-id-1', {
        status: KeyStatus.DELIVERED,
        keyData: 'new-key-data',
      });

      expect(keysRepository.update).toHaveBeenCalledWith('key-id-1', {
        status: KeyStatus.DELIVERED,
        keyData: 'new-key-data',
      });
      expect(result).toEqual(updatedKey);
    });
  });

  // ─── deleteKey ────────────────────────────────────────────────────
  describe('deleteKey', () => {
    it('deve deletar chave com sucesso', async () => {
      mockKeysRepository.delete.mockResolvedValue(mockKey);

      const result = await service.deleteKey('key-id-1');

      expect(keysRepository.delete).toHaveBeenCalledWith('key-id-1');
      expect(result).toEqual(mockKey);
    });
  });

  // ─── generateDemoKeys ─────────────────────────────────────────────
  describe('generateDemoKeys', () => {
    it('deve gerar chaves demo com quantidade padrao (10)', async () => {
      mockEncryptionProvider.generateSecureKey.mockReturnValue('demo-key-generated');
      mockKeysRepository.createBatch.mockResolvedValue({ imported: 10, failed: 0, errors: [] });

      await service.generateDemoKeys('product-id-1');

      expect(encryptionProvider.generateSecureKey).toHaveBeenCalledTimes(10);
      expect(encryptionProvider.generateSecureKey).toHaveBeenCalledWith(24);
      expect(keysRepository.createBatch).toHaveBeenCalledWith(
        'product-id-1',
        expect.arrayContaining([expect.any(String)]),
      );
    });

    it('deve gerar chaves demo com quantidade customizada', async () => {
      mockEncryptionProvider.generateSecureKey.mockReturnValue('demo-key');
      mockKeysRepository.createBatch.mockResolvedValue({ imported: 5, failed: 0, errors: [] });

      await service.generateDemoKeys('product-id-1', 5);

      expect(encryptionProvider.generateSecureKey).toHaveBeenCalledTimes(5);
      expect(keysRepository.createBatch).toHaveBeenCalledWith(
        'product-id-1',
        expect.arrayContaining([expect.any(String)]),
      );
    });
  });
});
