import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { KeyStatus } from '@prisma/client';
import { AccountsRepository } from '../accounts.repository';
import { KeysEncryptionProvider } from '@/modules/keys/keys-encryption.provider';
import { PrismaService } from '@/prisma/prisma.service';

describe('AccountsRepository', () => {
  let repository: AccountsRepository;

  const mockPrismaService = {
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    account: {
      count: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
    },
  };

  const mockEncryptionProvider = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsRepository,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: KeysEncryptionProvider, useValue: mockEncryptionProvider },
      ],
    }).compile();

    repository = module.get<AccountsRepository>(AccountsRepository);

    jest.clearAllMocks();
    mockEncryptionProvider.encrypt.mockImplementation((value: string) => `encrypted:${value}`);
    mockPrismaService.account.count.mockResolvedValue(1);
    mockPrismaService.product.update.mockResolvedValue({});
  });

  describe('createBatch', () => {
    it('throws when importing accounts into a key product', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'product-id-1',
        productType: 'KEY',
      });

      await expect(
        repository.createBatch('product-id-1', ['user@example.com:secret']),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.account.createMany).not.toHaveBeenCalled();
    });

    it('imports accounts for account products and syncs stock', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue({
        id: 'product-id-1',
        productType: 'ACCOUNT',
      });
      mockPrismaService.account.createMany.mockResolvedValue({ count: 1 });

      const result = await repository.createBatch('product-id-1', ['user@example.com:secret']);

      expect(mockPrismaService.account.createMany).toHaveBeenCalledWith({
        data: [
          {
            productId: 'product-id-1',
            email: 'encrypted:user@example.com',
            password: 'encrypted:secret',
            metadata: expect.anything(),
            status: KeyStatus.AVAILABLE,
          },
        ],
        skipDuplicates: false,
      });
      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: 'product-id-1' },
        data: { stock: 1 },
      });
      expect(result.imported).toBe(1);
    });
  });
});
