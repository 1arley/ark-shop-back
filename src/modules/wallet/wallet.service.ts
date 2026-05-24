import { Injectable } from '@nestjs/common';
import { WalletRepository } from './wallet.repository';
import { toNumber } from '@/common/decimal';

@Injectable()
export class WalletService {
  constructor(private readonly walletRepository: WalletRepository) {}

  async getWallet(userId: string) {
    const wallet = await this.walletRepository.findWalletByUserId(userId);
    if (!wallet) {
      // Create wallet if it doesn't exist
      return this.walletRepository.createWallet(userId);
    }
    return wallet;
  }

  async addBalance(userId: string, amount: number, description: string = 'Adição de saldo') {
    const wallet = await this.getWallet(userId);
    const balance = toNumber(wallet.balance) ?? 0;
    const cashback = toNumber(wallet.cashback) ?? 0;
    const newBalance = balance + amount;

    // Update wallet balance
    await this.walletRepository.updateBalance(userId, newBalance, cashback);

    // Create transaction record
    await this.walletRepository.createTransaction(wallet.id, 'credit', amount, description);

    return {
      balance: newBalance,
      transactionId: wallet.id,
    };
  }

  async deductBalance(userId: string, amount: number, description: string = 'Débito de saldo') {
    const wallet = await this.getWallet(userId);
    const balance = toNumber(wallet.balance) ?? 0;
    const cashback = toNumber(wallet.cashback) ?? 0;

    if (balance < amount) {
      throw new Error('Saldo insuficiente');
    }

    const newBalance = balance - amount;

    // Update wallet balance
    await this.walletRepository.updateBalance(userId, newBalance, cashback);

    // Create transaction record
    await this.walletRepository.createTransaction(wallet.id, 'debit', amount, description);

    return {
      balance: newBalance,
      transactionId: wallet.id,
    };
  }

  async addCashback(userId: string, amount: number, description: string = 'Cashback adicionado') {
    const wallet = await this.getWallet(userId);
    const balance = toNumber(wallet.balance) ?? 0;
    const cashback = toNumber(wallet.cashback) ?? 0;
    const newCashback = cashback + amount;

    // Update wallet cashback
    await this.walletRepository.updateBalance(userId, balance, newCashback);

    // Create transaction record
    await this.walletRepository.createTransaction(wallet.id, 'cashback', amount, description);

    return {
      cashback: newCashback,
      transactionId: wallet.id,
    };
  }

  async getTransactions(userId: string, page: number = 1, limit: number = 20) {
    const wallet = await this.getWallet(userId);
    return this.walletRepository.getTransactions(wallet.id, page, limit);
  }
}
