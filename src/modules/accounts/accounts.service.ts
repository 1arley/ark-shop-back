import { Injectable, Logger } from '@nestjs/common';
import { AccountsRepository } from './accounts.repository';
import { KeyStatus, Prisma } from '@prisma/client';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private readonly accountsRepository: AccountsRepository) {}

  async importAccounts(productId: string, rawLines: string[]) {
    if (rawLines.length === 0) {
      return { imported: 0, failed: 0, errors: ['No accounts provided'] };
    }

    const result = await this.accountsRepository.createBatch(productId, rawLines);
    this.logger.log(
      `Imported ${result.imported} accounts for product ${productId} (${result.failed} failed)`,
    );

    return result;
  }

  async getAccount(accountId: string) {
    return this.accountsRepository.findById(accountId);
  }

  async getProductAccounts(productId: string, page: number = 1, limit: number = 50) {
    return this.accountsRepository.findByProduct(productId, page, limit);
  }

  async getAccountStats(productId: string) {
    return this.accountsRepository.countByProduct(productId);
  }

  async updateAccount(
    accountId: string,
    data: {
      email?: string;
      password?: string;
      status?: KeyStatus;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return this.accountsRepository.update(accountId, data);
  }

  async deleteAccount(accountId: string) {
    return this.accountsRepository.delete(accountId);
  }

  async getDecryptedAccount(accountId: string) {
    return this.accountsRepository.getAccountData(accountId);
  }
}
