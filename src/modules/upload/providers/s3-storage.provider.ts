import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import * as path from 'path';
import * as crypto from 'crypto';
import type { StorageProvider, UploadedFileInfo } from '../storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint: string;
  private client!: S3Client;

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

  private ensureClient(): S3Client {
    if (this.client) return this.client;

    if (!this.bucket) {
      throw new Error(
        'S3 storage requires S3_BUCKET environment variable. ' +
          'Set STORAGE_DRIVER=local to use local storage.',
      );
    }

    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID', '');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY', '');
    const config: Record<string, any> = { region: this.region };
    if (accessKeyId && secretAccessKey) {
      config.credentials = { accessKeyId, secretAccessKey };
    }
    if (this.endpoint) {
      config.endpoint = this.endpoint;
      config.forcePathStyle = true;
    }
    this.client = new S3Client(config);
    return this.client;
  }

  async upload(file: Express.Multer.File, folder = 'general'): Promise<UploadedFileInfo> {
    const client = this.ensureClient();

    const ext = path.extname(file.originalname);
    const filename = `${crypto.randomUUID()}${ext}`;
    const key = `${folder}/${filename}`;

    const upload = new Upload({
      client,
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
    const client = this.ensureClient();

    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    this.logger.log(`File deleted from S3: ${key}`);
  }
}
