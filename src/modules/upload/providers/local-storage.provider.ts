import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import type { StorageProvider, UploadedFileInfo } from '../storage-provider.interface';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR', './uploads');
    this.baseUrl = this.configService.get<string>('UPLOAD_BASE_URL', '/uploads');
  }

  async upload(file: Express.Multer.File, folder = 'general'): Promise<UploadedFileInfo> {
    const dir = path.join(this.uploadDir, folder);
    await fs.mkdir(dir, { recursive: true });

    const ext = path.extname(file.originalname);
    const filename = `${crypto.randomUUID()}${ext}`;
    const filepath = path.join(dir, filename);

    await fs.writeFile(filepath, file.buffer);

    this.logger.log(`File saved: ${filepath}`);

    return {
      url: `${this.baseUrl}/${folder}/${filename}`,
      key: `${folder}/${filename}`,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  async delete(key: string): Promise<void> {
    const filepath = path.join(this.uploadDir, key);
    try {
      await fs.unlink(filepath);
      this.logger.log(`File deleted: ${filepath}`);
    } catch {
      this.logger.warn(`File not found for deletion: ${filepath}`);
    }
  }
}
