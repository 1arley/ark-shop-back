import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';
import { randomInt } from 'crypto';

/**
 * Keys Encryption Provider
 * Encrypts/decrypts sensitive key data using AES-256
 */
@Injectable()
export class KeysEncryptionProvider {
  private readonly encryptionKey: string;

  constructor(private readonly configService: ConfigService) {
    const encryptionKey = this.configService.get<string>('KEYS_ENCRYPTION_KEY');

    // CRITICAL: Always require encryption key - no fallbacks
    if (!encryptionKey) {
      throw new Error(
        'KEYS_ENCRYPTION_KEY environment variable is required. ' +
          'Generate a secure random key (min 32 characters). ' +
          "Example: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }

    // Validate key is not the placeholder
    if (encryptionKey === 'default-key-change-in-production') {
      throw new Error(
        'KEYS_ENCRYPTION_KEY is set to placeholder value. ' +
          'Please set a real encryption key (min 32 characters).',
      );
    }

    // Validate key strength
    if (encryptionKey.length < 32) {
      throw new Error(
        `KEYS_ENCRYPTION_KEY must be at least 32 characters (got ${encryptionKey.length}). ` +
          'Use a secure random key for production.',
      );
    }

    this.encryptionKey = encryptionKey;
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
   * Generate a cryptographically secure random key
   * Uses crypto.randomInt for secure random number generation
   */
  generateSecureKey(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < length; i++) {
      // CRITICAL: Use crypto.randomInt instead of Math.random()
      result += chars.charAt(randomInt(0, chars.length));
    }
    return result;
  }
}
