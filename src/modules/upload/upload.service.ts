import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import type { StorageProvider, UploadedFileInfo } from './storage-provider.interface';
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from '@/common/constants';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly provider: StorageProvider;
  private readonly maxFileSize: number;
  private readonly allowedMimes: string[];

  constructor(
    private readonly configService: ConfigService,
    localStorageProvider: LocalStorageProvider,
    s3StorageProvider: S3StorageProvider,
  ) {
    const driver = this.configService.get<string>('STORAGE_DRIVER', 'local');
    this.provider = driver === 's3' ? s3StorageProvider : localStorageProvider;
    this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', MAX_FILE_SIZE);
    this.allowedMimes = this.configService
      .get<string>('ALLOWED_MIME_TYPES', ALLOWED_MIME_TYPES)
      .split(',');
    this.logger.log(`Upload service initialized with driver: ${driver}`);
  }

  async upload(file: Express.Multer.File, folder = 'general'): Promise<UploadedFileInfo> {
    this.validateFile(file);
    return this.provider.upload(file, folder);
  }

  async delete(key: string): Promise<void> {
    return this.provider.delete(key);
  }

  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new Error('Nenhum arquivo enviado.');
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`Arquivo muito grande. Tamanho máximo: ${this.maxFileSize / 1024 / 1024}MB`);
    }

    if (!this.allowedMimes.includes(file.mimetype)) {
      throw new Error(`Tipo de arquivo não permitido: ${file.mimetype}`);
    }
  }
}
