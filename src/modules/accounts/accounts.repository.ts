import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { KeysEncryptionProvider } from '@/modules/keys/keys-encryption.provider';
import { KeyStatus, Prisma, ProductType, PrismaClientKnownRequestError } from '@prisma/client';

export interface ImportAccountsResult {
  imported: number;
  failed: number;
  errors: string[];
}

@Injectable()
export class AccountsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionProvider: KeysEncryptionProvider,
  ) {}

  private parseAccountLine(line: string): {
    email: string;
    password: string;
    metadata?: Prisma.InputJsonValue;
  } {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      throw new Error('Empty or comment line');
    }

    const firstColon = trimmed.indexOf(':');
    if (firstColon === -1) {
      throw new Error('Invalid format. Expected email:password');
    }

    const email = trimmed.slice(0, firstColon).trim();
    const rest = trimmed.slice(firstColon + 1).trim();

    const secondColon = rest.indexOf(':');
    let password: string;
    let metadata: Prisma.InputJsonValue | undefined;

    if (secondColon === -1) {
      password = rest;
    } else {
      password = rest.slice(0, secondColon).trim();
      try {
        metadata = JSON.parse(rest.slice(secondColon + 1).trim()) as Prisma.InputJsonValue;
      } catch {
        throw new Error('Invalid JSON metadata after password');
      }
    }

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    return { email, password, metadata };
  }

  private async ensureAccountProduct(
    productId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const product = await client.product.findUnique({
      where: { id: productId },
      select: { productType: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    if (product.productType !== ProductType.ACCOUNT) {
      throw new BadRequestException('Accounts can only be imported into ACCOUNT products');
    }
  }

  private async syncProductStock(
    productId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const availableAccounts = await tx.account.count({
      where: { productId, status: KeyStatus.AVAILABLE },
    });

    await tx.product.update({
      where: { id: productId },
      data: { stock: availableAccounts },
    });
  }

  async create(
    productId: string,
    email: string,
    password: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    const encryptedEmail = this.encryptionProvider.encrypt(email);
    const encryptedPassword = this.encryptionProvider.encrypt(password);

    return await this.prisma.$transaction(async tx => {
      await this.ensureAccountProduct(productId, tx);

      const account = await tx.account.create({
        data: {
          productId,
          email: encryptedEmail,
          password: encryptedPassword,
          metadata: metadata ?? Prisma.DbNull,
          status: KeyStatus.AVAILABLE,
        },
        include: { product: true },
      });

      await this.syncProductStock(productId, tx);
      return account;
    });
  }

  async createBatch(productId: string, rawLines: string[]): Promise<ImportAccountsResult> {
    const result: ImportAccountsResult = {
      imported: 0,
      failed: 0,
      errors: [],
    };

    const parsed: Array<{ email: string; password: string; metadata?: Prisma.InputJsonValue }> = [];

    for (const line of rawLines) {
      try {
        parsed.push(this.parseAccountLine(line));
      } catch (error: any) {
        result.failed++;
        result.errors.push(`Line "${line.slice(0, 50)}...": ${error.message || 'Parse error'}`);
      }
    }

    if (parsed.length === 0) {
      return result;
    }

    await this.ensureAccountProduct(productId);

    const data: Array<{
      productId: string;
      email: string;
      password: string;
      metadata: Prisma.InputJsonValue;
      status: KeyStatus;
    }> = parsed.map(({ email, password, metadata }) => ({
      productId,
      email: this.encryptionProvider.encrypt(email),
      password: this.encryptionProvider.encrypt(password),
      metadata: metadata ?? Prisma.DbNull,
      status: KeyStatus.AVAILABLE,
    }));

    try {
      await this.prisma.account.createMany({ data, skipDuplicates: false });
      result.imported = parsed.length;
    } catch (_error) {
      for (const entry of data) {
        try {
          await this.prisma.account.create({ data: entry });
          result.imported++;
        } catch (innerError: unknown) {
          result.failed++;
          const message =
            innerError instanceof PrismaClientKnownRequestError
              ? innerError.message
              : innerError instanceof Error
                ? innerError.message
                : 'Unknown error';
          result.errors.push(`Failed to import: ${message}`);
        }
      }
    }

    await this.syncProductStock(productId);

    return result;
  }

  async findById(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: { product: true, orderItem: true },
    });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return account;
  }

  async findByProduct(productId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [accounts, total] = await this.prisma.$transaction([
      this.prisma.account.findMany({
        where: { productId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
      this.prisma.account.count({ where: { productId } }),
    ]);

    return {
      data: accounts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  findAvailableAccount(productId: string) {
    return this.prisma.account.findFirst({
      where: { productId, status: KeyStatus.AVAILABLE },
    });
  }

  async deliverAccount(accountId: string) {
    return await this.prisma.$transaction(async tx => {
      const deliveredAccount = await tx.account.update({
        where: { id: accountId },
        data: { status: KeyStatus.DELIVERED, deliveredAt: new Date() },
      });

      await this.syncProductStock(deliveredAccount.productId, tx);
      return deliveredAccount;
    });
  }

  async getAccountData(
    accountId: string,
  ): Promise<{ email: string; password: string; metadata: unknown }> {
    const account = await this.findById(accountId);
    return {
      email: this.encryptionProvider.decrypt(account.email),
      password: this.encryptionProvider.decrypt(account.password),
      metadata: account.metadata,
    };
  }

  async countByProduct(productId: string) {
    const [available, reserved, delivered] = await Promise.all([
      this.prisma.account.count({ where: { productId, status: KeyStatus.AVAILABLE } }),
      this.prisma.account.count({ where: { productId, status: KeyStatus.RESERVED } }),
      this.prisma.account.count({ where: { productId, status: KeyStatus.DELIVERED } }),
    ]);

    return {
      total: available + reserved + delivered,
      available,
      reserved,
      delivered,
    };
  }

  async update(
    id: string,
    data: {
      email?: string;
      password?: string;
      status?: KeyStatus;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    const updateData: any = {};
    if (data.status) updateData.status = data.status;
    if (data.email) updateData.email = this.encryptionProvider.encrypt(data.email);
    if (data.password) updateData.password = this.encryptionProvider.encrypt(data.password);
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    const existing = await this.prisma.account.findUnique({
      where: { id },
      select: { productId: true },
    });

    if (!existing) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    return this.prisma.$transaction(async tx => {
      const account = await tx.account.update({
        where: { id },
        data: updateData,
        include: { product: true },
      });

      if (data.status) {
        await this.syncProductStock(existing.productId, tx);
      }

      return account;
    });
  }

  async delete(id: string) {
    const account = await this.prisma.account.findUnique({ where: { id } });

    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }

    if (account.status !== KeyStatus.AVAILABLE) {
      throw new BadRequestException('Can only delete available accounts');
    }

    return this.prisma.$transaction(async tx => {
      const deleted = await tx.account.delete({ where: { id } });
      await this.syncProductStock(account.productId, tx);
      return deleted;
    });
  }
}
