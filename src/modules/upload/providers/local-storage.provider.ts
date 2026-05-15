import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
    this.uploadDir = path.resolve(this.configService.get<string>('UPLOAD_DIR', './uploads'));
    this.baseUrl = this.configService.get<string>('UPLOAD_BASE_URL', '/uploads');
  }

  /**
   * Sanitiza um caminho para evitar path traversal.
   * Remove '..', garante que o resultado fique dentro do diretório base.
   */
  private sanitizePath(segments: string[]): string {
    const fullPath = path.resolve(this.uploadDir, ...segments);
    if (!fullPath.startsWith(this.uploadDir)) {
      throw new BadRequestException('Invalid path: directory traversal detected');
    }
    return fullPath;
  }

  /**
   * Sanitiza um nome de arquivo/pasta removendo caracteres perigosos.
   * Remove qualquer caractere que não seja alfanumérico, hífen ou underscore
   * para prevenir path traversal via '..' ou '....'.
   */
  private sanitizeSegment(segment: string): string {
    // Remove qualquer caractere não seguro para nome de diretório/arquivo
    return segment.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  async upload(file: Express.Multer.File, folder = 'general'): Promise<UploadedFileInfo> {
    const safeFolder = this.sanitizeSegment(folder);
    const dir = this.sanitizePath([safeFolder]);
    await fs.mkdir(dir, { recursive: true });

    const ext = path.extname(file.originalname);
    const filename = `${crypto.randomUUID()}${ext}`;
    const filepath = path.join(dir, filename);

    // Verificação extra: o arquivo deve estar dentro do diretório de upload
    if (!filepath.startsWith(this.uploadDir)) {
      throw new BadRequestException('Invalid file path: directory traversal detected');
    }

    await fs.writeFile(filepath, file.buffer);

    this.logger.log(`File saved: ${filepath}`);

    return {
      url: `${this.baseUrl}/${safeFolder}/${filename}`,
      key: `${safeFolder}/${filename}`,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  async delete(key: string): Promise<void> {
    // Sanitiza a key para evitar path traversal
    // Divide a key em segmentos e sanitiza cada um individualmente
    const segments = key.split('/').map(s => this.sanitizeSegment(s));
    const filepath = this.sanitizePath(segments);

    try {
      await fs.unlink(filepath);
      this.logger.log(`File deleted: ${filepath}`);
    } catch {
      this.logger.warn(`File not found for deletion: ${filepath}`);
    }
  }
}
