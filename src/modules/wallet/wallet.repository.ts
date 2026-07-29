import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Wallet, Prisma } from '@prisma/client';

export interface BalanceUpdateResult {
  balance: number;
  cashback: number;
  transactionId: string;
}

/** Custom error for insufficient wallet balance — enables type-safe catch handling */
export class InsufficientFundsError extends Error {
  constructor() {
    super('Saldo insuficiente');
    this.name = 'InsufficientFundsError';
  }
}

/** Custom error for missing wallet — enables type-safe catch handling */
export class WalletNotFoundError extends Error {
  constructor(userId: string) {
    super(`Wallet not found for user: ${userId}`);
    this.name = 'WalletNotFoundError';
  }
}

@Injectable()
export class WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  findWalletByUserId(userId: string): Promise<Wallet | null> {
    return this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  createWallet(userId: string): Promise<Wallet> {
    // Use upsert to prevent race condition between check and create
    return this.prisma.wallet.upsert({
      where: { userId },
      create: {
        userId,
        balance: 0,
        cashback: 0,
      },
      update: {},
    });
  }

  /**
   * Atomically add balance and record the transaction in a single database transaction.
   * Both operations succeed or fail together, preserving the financial audit trail.
   */
  addBalance(
    userId: string,
    amount: number,
    type: string = 'credit',
    description: string | null = null,
  ): Promise<BalanceUpdateResult> {
    return this.prisma.$transaction(async tx => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
        select: { id: true, balance: true, cashback: true },
      });

      if (!wallet) {
        throw new WalletNotFoundError(userId);
      }

      const currentCashback = toNumber(wallet.cashback) ?? 0;

      // Atomic increment to prevent race conditions
      await tx.wallet.update({
        where: { userId },
        data: {
          balance: { increment: amount },
        },
      });

      // Create transaction record INSIDE the same transaction
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          description,
        },
      });

      // Fetch updated balance after atomic operation
      const updatedWallet = await tx.wallet.findUnique({
        where: { userId },
        select: { balance: true },
      });

      return {
        balance: toNumber(updatedWallet!.balance)!,
        cashback: currentCashback,
        transactionId: transaction.id,
      };
    });
  }

  /**
   * Atomically deduct balance and record the transaction in a single database transaction.
   * Both operations succeed or fail together, preserving the financial audit trail.
   * Throws InsufficientFundsError if balance is too low.
   */
  deductBalance(
    userId: string,
    amount: number,
    type: string = 'debit',
    description: string | null = null,
  ): Promise<BalanceUpdateResult> {
    return this.prisma.$transaction(async tx => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
        select: { id: true, balance: true, cashback: true },
      });

      if (!wallet) {
        throw new WalletNotFoundError(userId);
      }

      const currentBalance = toNumber(wallet.balance) ?? 0;
      const currentCashback = toNumber(wallet.cashback) ?? 0;

      if (currentBalance < amount) {
        throw new InsufficientFundsError();
      }

      // Atomic decrement to prevent race conditions
      await tx.wallet.update({
        where: { userId },
        data: {
          balance: { decrement: amount },
        },
      });

      // Create transaction record INSIDE the same transaction
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          description,
        },
      });

      // Fetch updated balance after atomic operation
      const updatedWallet = await tx.wallet.findUnique({
        where: { userId },
        select: { balance: true },
      });

      return {
        balance: toNumber(updatedWallet!.balance)!,
        cashback: currentCashback,
        transactionId: transaction.id,
      };
    });
  }

  /**
   * Atomically add cashback and record the transaction in a single database transaction.
   * Both operations succeed or fail together, preserving the financial audit trail.
   */
  addCashback(
    userId: string,
    amount: number,
    type: string = 'cashback',
    description: string | null = null,
  ): Promise<BalanceUpdateResult> {
    return this.prisma.$transaction(async tx => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
        select: { id: true, balance: true, cashback: true },
      });

      if (!wallet) {
        throw new WalletNotFoundError(userId);
      }

      const currentBalance = toNumber(wallet.balance) ?? 0;

      // Atomic increment to prevent race conditions
      await tx.wallet.update({
        where: { userId },
        data: {
          cashback: { increment: amount },
        },
      });

      // Create transaction record INSIDE the same transaction
      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount,
          description,
        },
      });

      // Fetch updated cashback after atomic operation
      const updatedWallet = await tx.wallet.findUnique({
        where: { userId },
        select: { cashback: true },
      });

      return {
        balance: currentBalance,
        cashback: toNumber(updatedWallet!.cashback)!,
        transactionId: transaction.id,
      };
    });
  }

  updateBalance(userId: string, balance: number, cashback: number): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { userId },
      data: {
        balance,
        cashback,
      },
    });
  }

  /**
   * Get transactions with cursor-based pagination for better performance.
   * Uses the last transaction ID from the previous page as the cursor.
   * Note: The cursor item itself is excluded from results to avoid duplicates.
   */
  async getTransactions(walletId: string, page: number = 1, limit: number = 20, cursorId?: string) {
    // For page 1, no cursor; otherwise use cursor-based pagination
    const cursor = cursorId ? { id: cursorId } : undefined;
    const take = limit + 1; // Take one extra to check if there are more results

    const transactions = await this.prisma.walletTransaction.findMany({
      where: { walletId },
      ...(cursor && {
        cursor,
        // Skip the cursor item itself to avoid returning the same item twice
        skip: 1,
      }),
      take: take,
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = transactions.length > limit;
    const resultTransactions = hasMore ? transactions.slice(0, limit) : transactions;

    // Get total count for metadata
    const total = await this.prisma.walletTransaction.count({
      where: { walletId },
    });

    return {
      data: resultTransactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        nextCursor: hasMore ? resultTransactions[resultTransactions.length - 1]?.id : undefined,
      },
    };
  }
}

// Helper function to convert Decimal to number

function toNumber(value: number | Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return value;
  }
  return value.toNumber();
}
