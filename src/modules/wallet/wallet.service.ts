import { Injectable, Logger } from '@nestjs/common';
import { WalletRepository, InsufficientFundsError, WalletNotFoundError } from './wallet.repository';
import type { Wallet, WalletTransaction } from '@prisma/client';

/**
 * Result types for wallet operations using TypeScript advanced types
 */
interface WalletBalanceResult {
  balance: number;
  transactionId: string;
}

interface WalletCashbackResult {
  cashback: number;
  transactionId: string;
}

interface WalletTransactionsResult {
  data: WalletTransaction[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    nextCursor?: string;
  };
}

/**
 * Discriminated union for wallet operation results
 * Enables type-safe error handling with narrowable types
 */
type WalletOperationResult<T> =
  | { success: true; data: T }
  | { success: false; error: 'INSUFFICIENT_FUNDS' | 'WALLET_NOT_FOUND'; message: string };

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly walletRepository: WalletRepository) {}

  /**
   * Get or create wallet for user
   * @param userId - User ID to fetch wallet for
   * @returns Wallet entity
   */
  async getWallet(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findWalletByUserId(userId);

    if (!wallet) {
      return this.walletRepository.createWallet(userId);
    }

    return wallet;
  }

  /**
   * Atomically add balance to user's wallet and record the transaction.
   * The balance update and transaction record are committed in a single
   * database transaction, preserving the financial audit trail.
   * @param userId - User ID
   * @param amount - Amount to add
   * @param description - Transaction description
   * @returns Balance result with transaction ID
   */
  async addBalance(
    userId: string,
    amount: number,
    description: string = 'Adição de saldo',
  ): Promise<WalletBalanceResult> {
    const result = await this.walletRepository.addBalance(userId, amount, 'credit', description);

    return {
      balance: result.balance,
      transactionId: result.transactionId,
    };
  }

  /**
   * Atomically deduct balance from user's wallet and record the transaction.
   * The balance check, decrement, and transaction record are committed in a
   * single database transaction, preventing TOCTOU race conditions and
   * preserving the financial audit trail.
   * @param userId - User ID
   * @param amount - Amount to deduct
   * @param description - Transaction description
   * @returns Balance result or error
   */
  async deductBalance(
    userId: string,
    amount: number,
    description: string = 'Débito de saldo',
  ): Promise<WalletOperationResult<WalletBalanceResult>> {
    try {
      const result = await this.walletRepository.deductBalance(
        userId,
        amount,
        'debit',
        description,
      );

      return {
        success: true,
        data: {
          balance: result.balance,
          transactionId: result.transactionId,
        },
      };
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        return {
          success: false,
          error: 'INSUFFICIENT_FUNDS',
          message: 'Saldo insuficiente',
        };
      }

      if (error instanceof WalletNotFoundError) {
        return {
          success: false,
          error: 'WALLET_NOT_FOUND',
          message: 'Carteira não encontrada',
        };
      }

      this.logger.error(`Unexpected error in deductBalance: ${String(error)}`);
      throw error;
    }
  }

  /**
   * Atomically add cashback to user's wallet and record the transaction.
   * The cashback update and transaction record are committed in a single
   * database transaction, preserving the financial audit trail.
   * @param userId - User ID
   * @param amount - Cashback amount to add
   * @param description - Transaction description
   * @returns Cashback result with transaction ID
   */
  async addCashback(
    userId: string,
    amount: number,
    description: string = 'Cashback adicionado',
  ): Promise<WalletCashbackResult> {
    const result = await this.walletRepository.addCashback(userId, amount, 'cashback', description);

    return {
      cashback: result.cashback,
      transactionId: result.transactionId,
    };
  }

  /**
   * Get wallet transactions with pagination
   * @param userId - User ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Paginated transactions
   */
  async getTransactions(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<WalletTransactionsResult> {
    const wallet = await this.getWallet(userId);
    return this.walletRepository.getTransactions(wallet.id, page, limit);
  }
}
