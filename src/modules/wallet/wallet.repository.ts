import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Wallet, WalletTransaction, Prisma } from '@prisma/client';

export interface BalanceUpdateResult {
  balance: number;
  cashback: number;
  transactionId: string;
}

@Injectable()
export class WalletRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findWalletByUserId(userId: string): Promise<Wallet | null> {
    return this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async createWallet(userId: string): Promise<Wallet> {
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
   * Atomically increment balance by amount to avoid race conditions.
   * Uses Prisma's atomic increment operation to prevent concurrent update conflicts.
   */
  async addBalance(userId: string, amount: number): Promise<BalanceUpdateResult> {
    return this.prisma.$transaction(async tx => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
        select: { id: true, balance: true, cashback: true },
      });

      if (!wallet) {
        throw new Error('Wallet not found for user');
      }

      const currentCashback = toNumber(wallet.cashback) ?? 0;

      // Use atomic increment to prevent race conditions
      await tx.wallet.update({
        where: { userId },
        data: {
          balance: {
            increment: amount,
          },
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
        transactionId: wallet.id,
      };
    });
  }

  /**
   * Atomically deduct balance by amount to avoid race conditions.
   * Uses Prisma's atomic decrement operation to prevent concurrent update conflicts.
   */
  async deductBalance(userId: string, amount: number): Promise<BalanceUpdateResult> {
    return this.prisma.$transaction(async tx => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
        select: { id: true, balance: true, cashback: true },
      });

      if (!wallet) {
        throw new Error('Wallet not found for user');
      }

      const currentBalance = toNumber(wallet.balance) ?? 0;
      const currentCashback = toNumber(wallet.cashback) ?? 0;

      if (currentBalance < amount) {
        throw new Error('Saldo insuficiente');
      }

      // Use atomic decrement to prevent race conditions
      await tx.wallet.update({
        where: { userId },
        data: {
          balance: {
            decrement: amount,
          },
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
        transactionId: wallet.id,
      };
    });
  }

  /**
   * Atomically add cashback to avoid race conditions.
   * Uses Prisma's atomic increment operation to prevent concurrent update conflicts.
   */
  async addCashback(userId: string, amount: number): Promise<BalanceUpdateResult> {
    return this.prisma.$transaction(async tx => {
      const wallet = await tx.wallet.findUnique({
        where: { userId },
        select: { id: true, balance: true, cashback: true },
      });

      if (!wallet) {
        throw new Error('Wallet not found for user');
      }

      const currentBalance = toNumber(wallet.balance) ?? 0;

      // Use atomic increment to prevent race conditions
      await tx.wallet.update({
        where: { userId },
        data: {
          cashback: {
            increment: amount,
          },
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
        transactionId: wallet.id,
      };
    });
  }

  async updateBalance(userId: string, balance: number, cashback: number): Promise<Wallet> {
    return this.prisma.wallet.update({
      where: { userId },
      data: {
        balance,
        cashback,
      },
    });
  }

  async createTransaction(
    walletId: string,
    type: string,
    amount: number,
    description: string | null = null,
    referenceId: string | null = null,
  ): Promise<WalletTransaction> {
    return this.prisma.walletTransaction.create({
      data: {
        walletId,
        type,
        amount,
        description,
        referenceId,
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
