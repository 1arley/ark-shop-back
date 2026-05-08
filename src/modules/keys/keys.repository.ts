import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { KeysEncryptionProvider } from './keys-encryption.provider';
import { KeyStatus } from '@prisma/client';

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

  async create(productId: string, keyData: string) {
    const encryptedKey = this.encryptionProvider.encrypt(keyData);

    return this.prisma.key.create({
      data: {
        productId,
        keyData: encryptedKey,
        status: KeyStatus.AVAILABLE,
      },
      include: {
        product: true,
      },
    });
  }

  async createBatch(productId: string, keys: string[]): Promise<ImportKeysResult> {
    const result: ImportKeysResult = {
      imported: 0,
      failed: 0,
      errors: [],
    };

    for (const key of keys) {
      try {
        await this.create(productId, key);
        result.imported++;
      } catch (error: any) {
        result.failed++;
        result.errors.push(`Failed to import key: ${error.message || 'Unknown error'}`);
      }
    }

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
    const key = await this.prisma.key.findUnique({
      where: { id: keyId },
    });

    if (!key) {
      throw new NotFoundException(`Key with ID ${keyId} not found`);
    }

    if (key.status !== KeyStatus.AVAILABLE) {
      throw new BadRequestException(`Key is not available (current status: ${key.status})`);
    }

    return this.prisma.key.update({
      where: { id: keyId },
      data: {
        status: KeyStatus.RESERVED,
        orderItemId,
      },
    });
  }

  async deliverKey(keyId: string) {
    return this.prisma.key.update({
      where: { id: keyId },
      data: {
        status: KeyStatus.DELIVERED,
        deliveredAt: new Date(),
      },
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

    return this.prisma.key.delete({
      where: { id },
    });
  }
}
