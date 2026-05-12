import { Injectable, BadRequestException } from '@nestjs/common';
import { KeysRepository } from './keys.repository';
import { KeysEncryptionProvider } from './keys-encryption.provider';
import { KeyStatus } from '@prisma/client';

@Injectable()
export class KeysService {
  constructor(
    private readonly keysRepository: KeysRepository,
    private readonly encryptionProvider: KeysEncryptionProvider,
  ) {}

  async importKeys(productId: string, keys: string[]) {
    if (keys.length === 0) {
      throw new BadRequestException('Keys array cannot be empty');
    }

    return this.keysRepository.createBatch(productId, keys);
  }

  async getKey(keyId: string) {
    return this.keysRepository.findById(keyId);
  }

  async getAvailableKey(productId: string) {
    return this.keysRepository.findAvailableKey(productId);
  }

  async reserveKeyForOrder(keyId: string, orderItemId: string) {
    return this.keysRepository.reserveKey(keyId, orderItemId);
  }

  async deliverKey(keyId: string) {
    const key = await this.keysRepository.deliverKey(keyId);

    // Decrypt and return the key data
    const decryptedKey = await this.keysRepository.getKeyData(keyId);

    return {
      ...key,
      decryptedKey, // Only returned on delivery
    };
  }

  async getProductKeys(productId: string, page: number = 1, limit: number = 50) {
    return this.keysRepository.findByProduct(productId, page, limit);
  }

  async getKeyStats(productId: string) {
    return this.keysRepository.countByProduct(productId);
  }

  async updateKey(keyId: string, data: { keyData?: string; status?: KeyStatus }) {
    return this.keysRepository.update(keyId, data);
  }

  async deleteKey(keyId: string) {
    return this.keysRepository.delete(keyId);
  }

  /**
   * Generate demo keys for testing
   */
  async generateDemoKeys(productId: string, quantity: number = 10) {
    const keys = Array.from({ length: quantity }, () =>
      this.encryptionProvider.generateSecureKey(24),
    );

    return this.importKeys(productId, keys);
  }
}
