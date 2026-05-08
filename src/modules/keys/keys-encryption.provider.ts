import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class KeysEncryptionProvider {
  private readonly encryptionKey: string;

  constructor(private readonly configService: ConfigService) {
    this.encryptionKey =
      this.configService.get<string>('KEYS_ENCRYPTION_KEY') || 'default-key-change-in-production';

    if (this.encryptionKey === 'default-key-change-in-production') {
      console.warn(
        '⚠️  WARNING: Using default encryption key. Set KEYS_ENCRYPTION_KEY environment variable in production!',
      );
    }
  }

  /**
   * Encrypt sensitive key data using AES-256
   */
  encrypt(data: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
      return encrypted;
    } catch (_error) {
      throw new BadRequestException('Failed to encrypt key data');
    }
  }

  /**
   * Decrypt sensitive key data
   */
  decrypt(encryptedData: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);

      if (!decrypted) {
        throw new Error('Decryption resulted in empty string');
      }

      return decrypted;
    } catch (_error) {
      throw new BadRequestException('Failed to decrypt key data');
    }
  }

  /**
   * Encrypt multiple keys in batch
   */
  encryptBatch(keys: string[]): string[] {
    return keys.map(key => this.encrypt(key));
  }

  /**
   * Decrypt multiple keys in batch
   */
  decryptBatch(encryptedKeys: string[]): string[] {
    return encryptedKeys.map(key => this.decrypt(key));
  }

  /**
   * Generate a secure random key (for testing/demo purposes)
   */
  generateSecureKey(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
