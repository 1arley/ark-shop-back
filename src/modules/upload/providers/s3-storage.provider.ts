import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as crypto from 'crypto';
import type { StorageProvider, UploadedFileInfo } from '../storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint: string;
  private client: any;
  private UploadClass: any;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('S3_BUCKET', '');
    this.region = this.configService.get<string>('S3_REGION', 'us-east-1');
    this.endpoint = this.configService.get<string>('S3_ENDPOINT', '');
  }

  private getBaseUrl(): string {
    return this.configService.get<string>(
      'UPLOAD_BASE_URL',
      `https://${this.bucket}.s3.${this.region}.amazonaws.com`,
    );
  }

  private async ensureClient(): Promise<void> {
    if (this.client) return;

    if (!this.bucket) {
      throw new Error(
        'S3 storage requires S3_BUCKET environment variable. ' +
          'Set STORAGE_DRIVER=local to use local storage.',
      );
    }

    try {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const { Upload } = await import('@aws-sdk/lib-storage');
      const config: any = { region: this.region };
      if (this.endpoint) {
        config.endpoint = this.endpoint;
        config.forcePathStyle = true;
      }
      this.client = new S3Client(config);
      this.UploadClass = Upload;
    } catch {
      throw new Error(
        'S3 storage requires @aws-sdk/client-s3 and @aws-sdk/lib-storage. ' +
          'Install them: npm install @aws-sdk/client-s3 @aws-sdk/lib-storage',
      );
    }
  }

  async upload(file: Express.Multer.File, folder = 'general'): Promise<UploadedFileInfo> {
    await this.ensureClient();

    const ext = path.extname(file.originalname);
    const filename = `${crypto.randomUUID()}${ext}`;
    const key = `${folder}/${filename}`;

    const upload = new this.UploadClass({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });

    await upload.done();

    const url = `${this.getBaseUrl()}/${key}`;

    this.logger.log(`File uploaded to S3: ${key}`);

    return {
      url,
      key,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  async delete(key: string): Promise<void> {
    await this.ensureClient();
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    this.logger.log(`File deleted from S3: ${key}`);
  }
}
