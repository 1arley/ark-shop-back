import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { KeysEncryptionProvider } from './keys-encryption.provider';
import { KeyStatus, Prisma } from '@prisma/client';

export interface ImportKeysResult {
  imported: number;
  failed: number;
  errors: string[];
}

@Injectable()
export class KeysRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionProvider: KeysEncryptionProvider,
  ) {}

  private async syncProductStock(
    productId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const availableKeys = await client.key.count({
      where: {
        productId,
        status: KeyStatus.AVAILABLE,
      },
    });

    await client.product.update({
      where: { id: productId },
      data: { stock: availableKeys },
    });
  }

  async create(productId: string, keyData: string) {
    const encryptedKey = this.encryptionProvider.encrypt(keyData);
    return await this.prisma.$transaction(async tx => {
      const createdKey = await tx.key.create({
        data: {
          productId,
          keyData: encryptedKey,
          status: KeyStatus.AVAILABLE,
        },
        include: {
          product: true,
        },
      });

      await this.syncProductStock(productId, tx);

      return createdKey;
    });
  }

  async createBatch(productId: string, keys: string[]): Promise<ImportKeysResult> {
    const result: ImportKeysResult = {
      imported: 0,
      failed: 0,
      errors: [],
    };

    // Encrypt all keys in batch (single-pass iteration)
    const encryptedKeys: string[] = [];
    for (const key of keys) {
      try {
        encryptedKeys.push(this.encryptionProvider.encrypt(key));
      } catch (error: any) {
        result.failed++;
        result.errors.push(`Failed to encrypt key: ${error.message || 'Unknown error'}`);
      }
    }

    if (encryptedKeys.length === 0) {
      return result;
    }

    // Bulk insert with createMany (single DB round-trip)
    try {
      await this.prisma.key.createMany({
        data: encryptedKeys.map(keyData => ({
          productId,
          keyData,
          status: KeyStatus.AVAILABLE,
        })),
        skipDuplicates: true,
      });
      result.imported = encryptedKeys.length;
    } catch (_error: any) {
      // Fallback: insert one by one if createMany fails (e.g. too many params)
      for (const keyData of encryptedKeys) {
        try {
          await this.prisma.key.create({
            data: {
              productId,
              keyData,
              status: KeyStatus.AVAILABLE,
            },
          });
          result.imported++;
        } catch (innerError: any) {
          result.failed++;
          result.errors.push(`Failed to import key: ${innerError.message || 'Unknown error'}`);
        }
      }
    }

    await this.syncProductStock(productId);

    return result;
  }

  async findById(id: string) {
    const key = await this.prisma.key.findUnique({
      where: { id },
      include: {
        product: true,
        orderItem: true,
      },
    });

    if (!key) {
      throw new NotFoundException(`Key with ID ${id} not found`);
    }

    return key;
  }

  async findByProduct(productId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [keys, total] = await this.prisma.$transaction([
      this.prisma.key.findMany({
        where: { productId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        // Exclude encrypted keyData from list responses
        select: {
          id: true,
          productId: true,
          status: true,
          orderItemId: true,
          deliveredAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.key.count({ where: { productId } }),
    ]);

    return {
      data: keys,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findAvailableKey(productId: string) {
    const key = await this.prisma.key.findFirst({
      where: {
        productId,
        status: KeyStatus.AVAILABLE,
      },
    });

    return key;
  }

  async reserveKey(keyId: string, orderItemId: string) {
    return this.prisma.$transaction(async tx => {
      const existingKey = await tx.key.findUnique({
        where: { id: keyId },
        select: { id: true, productId: true, status: true },
      });

      if (!existingKey) {
        throw new NotFoundException(`Key with ID ${keyId} not found`);
      }

      // Atomic update: only succeeds if key is still AVAILABLE
      const result = await tx.key.updateMany({
        where: { id: keyId, status: KeyStatus.AVAILABLE },
        data: {
          status: KeyStatus.RESERVED,
          orderItemId,
        },
      });

      if (result.count === 0) {
        throw new BadRequestException(
          `Key is not available (current status: ${existingKey.status})`,
        );
      }

      await this.syncProductStock(existingKey.productId, tx);

      return tx.key.findUnique({
        where: { id: keyId },
        include: { product: true },
      });
    });
  }

  /**
   * Reserva atomicamente a primeira chave disponível para um produto.
   * A operação de busca e atualização ocorre dentro de uma transação
   * para prevenir condições de corrida (TOCTOU).
   */
  async reserveAvailableKeyAtomic(productId: string, orderItemId: string) {
    return await this.prisma.$transaction(async tx => {
      const availableKey = await tx.key.findFirst({
        where: {
          productId,
          status: KeyStatus.AVAILABLE,
        },
      });

      if (!availableKey) {
        throw new BadRequestException(`No available keys for product ${productId}`);
      }

      return tx.key.update({
        where: { id: availableKey.id },
        data: {
          status: KeyStatus.RESERVED,
          orderItemId,
        },
      });
    });
  }

  async deliverKey(keyId: string) {
    return await this.prisma.$transaction(async tx => {
      const deliveredKey = await tx.key.update({
        where: { id: keyId },
        data: {
          status: KeyStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });

      await this.syncProductStock(deliveredKey.productId, tx);

      return deliveredKey;
    });
  }

  async getKeyData(keyId: string): Promise<string> {
    const key = await this.findById(keyId);
    return this.encryptionProvider.decrypt(key.keyData);
  }

  async countByProduct(productId: string) {
    const [available, reserved, delivered] = await Promise.all([
      this.prisma.key.count({
        where: { productId, status: KeyStatus.AVAILABLE },
      }),
      this.prisma.key.count({
        where: { productId, status: KeyStatus.RESERVED },
      }),
      this.prisma.key.count({
        where: { productId, status: KeyStatus.DELIVERED },
      }),
    ]);

    return {
      available,
      reserved,
      delivered,
      total: available + reserved + delivered,
    };
  }

  async update(id: string, data: { keyData?: string; status?: KeyStatus }) {
    const updateData: any = {};
    if (data.status) {
      updateData.status = data.status;
    }
    if (data.keyData) {
      updateData.keyData = this.encryptionProvider.encrypt(data.keyData);
    }

    const existingKey = await this.prisma.key.findUnique({
      where: { id },
      select: { productId: true },
    });

    if (!existingKey) {
      throw new NotFoundException(`Key with ID ${id} not found`);
    }

    return this.prisma.$transaction(async tx => {
      const key = await tx.key.update({
        where: { id },
        data: updateData,
        include: { product: true },
      });

      if (data.status) {
        await this.syncProductStock(existingKey.productId, tx);
      }

      return key;
    });
  }

  async delete(id: string) {
    const key = await this.prisma.key.findUnique({
      where: { id },
    });

    if (!key) {
      throw new NotFoundException(`Key with ID ${id} not found`);
    }

    if (key.status !== KeyStatus.AVAILABLE) {
      throw new BadRequestException('Can only delete available keys');
    }

    return this.prisma.$transaction(async tx => {
      const deletedKey = await tx.key.delete({
        where: { id },
      });

      await this.syncProductStock(key.productId, tx);

      return deletedKey;
    });
  }
}
