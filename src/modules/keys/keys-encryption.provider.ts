import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes, createHash, randomUUID } from 'crypto';
import * as CryptoJS from 'crypto-js';

/**
 * Keys Encryption Provider
 * Encrypts/decrypts sensitive key data using AES-256-GCM (Node.js native crypto).
 *
 * Backward compatible: decrypts legacy crypto-js format (CBC) for existing data.
 * New encryptions use AES-256-GCM with random IV per operation.
 *
 * Format: "v2:" + base64(iv(16) + tag(16) + ciphertext)
 */
@Injectable()
export class KeysEncryptionProvider {
  private readonly logger = new Logger(KeysEncryptionProvider.name);
  private readonly encryptionKey: string;
  private readonly cipherKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('KEYS_ENCRYPTION_KEY');

    if (!key || key.length < 32) {
      throw new Error(
        'KEYS_ENCRYPTION_KEY must be set and at least 32 characters long. ' +
          'Application startup aborted to prevent insecure key storage. ' +
          "Generate a secure key: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }

    this.encryptionKey = key;
    // Derive a 256-bit key via SHA-256 for AES-256
    this.cipherKey = createHash('sha256').update(key).digest();
  }

  /**
   * Encrypt sensitive key data using AES-256-GCM
   */
  encrypt(data: string): string {
    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-gcm', this.cipherKey, iv);

      const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();

      // Format: v2:base64(iv + tag + ciphertext)
      const combined = Buffer.concat([iv, tag, encrypted]);
      return 'v2:' + combined.toString('base64');
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw new BadRequestException('Failed to encrypt key data');
    }
  }

  /**
   * Decrypt sensitive key data
   * Supports both v2 (AES-256-GCM) and legacy (crypto-js) formats
   */
  decrypt(encryptedData: string): string {
    try {
      if (encryptedData.startsWith('v2:')) {
        return this.decryptV2(encryptedData);
      }
      // Legacy crypto-js format — backward compatible
      return this.decryptLegacy(encryptedData);
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw new BadRequestException('Failed to decrypt key data');
    }
  }

  /**
   * Decrypt v2 format: AES-256-GCM with Node crypto
   */
  private decryptV2(encryptedData: string): string {
    const combined = Buffer.from(encryptedData.slice(3), 'base64');

    if (combined.length < 32) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = combined.subarray(0, 16);
    const tag = combined.subarray(16, 32);
    const encrypted = combined.subarray(32);

    const decipher = createDecipheriv('aes-256-gcm', this.cipherKey, iv);
    decipher.setAuthTag(tag);

    const decrypted = decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');

    if (!decrypted) {
      throw new Error('Decryption resulted in empty string');
    }

    return decrypted;
  }

  /**
   * Decrypt legacy crypto-js format (AES/CBC/PKCS7Padding)
   * Kept for backward compatibility with existing encrypted keys
   */
  private decryptLegacy(encryptedData: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      throw new Error('Decryption resulted in empty string');
    }
    return decrypted;
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
   * Generate a demo key for testing purposes only
   * NOT cryptographically secure for production use
   * Uses Node.js crypto.randomUUID which has ~122 bits of entropy (not suitable for game keys)
   */
  generateDemoKey(length: number = 32): string {
    // Use crypto.randomUUID for demo/testing purposes only
    const uuid = randomUUID().replace(/-/g, '');
    // Pad/reduce to desired length
    if (length <= uuid.length) {
      return uuid.slice(0, length);
    }
    // Generate additional characters if needed
    let result = uuid;
    while (result.length < length) {
      result += randomUUID().replace(/-/g, '');
    }
    return result.slice(0, length).toUpperCase();
  }
}
