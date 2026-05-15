import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';
import { MAX_FILE_SIZE } from '@/common/constants';

@Module({
  imports: [
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE * 2 }, // 10MB — allow slightly more at Multer level than app-level
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, LocalStorageProvider, S3StorageProvider],
  exports: [UploadService],
})
export class UploadModule {}
