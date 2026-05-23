import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
  MaxFileSizeValidator,
  ParseFilePipe,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { RequireVerifiedEmail } from '@/auth/decorators/require-verified-email.decorator';
import { ConfigService } from '@nestjs/config';
import {
  MAX_FILE_SIZE,
  MAX_MULTIPLE_FILES,
  ALLOWED_MIME_TYPES,
  ALLOWED_MIME_REGEX,
} from '@/common/constants';

@ApiTags('upload')
@Controller('upload')
@RequireVerifiedEmail()
@ApiBearerAuth()
export class UploadController {
  private readonly maxFileSize: number;
  private readonly allowedMimes: string[];

  constructor(
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService,
  ) {
    this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', MAX_FILE_SIZE);
    this.allowedMimes = this.configService
      .get<string>('ALLOWED_MIME_TYPES', ALLOWED_MIME_TYPES)
      .split(',');
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE }, // 5MB — reject early at Multer level
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a single file' })
  @ApiResponse({ status: 201, description: 'File uploaded' })
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({
            fileType: ALLOWED_MIME_REGEX,
          }),
        ],
        fileIsRequired: true,
      }),
    )
    file: Express.Multer.File,
    @Body('folder') folder?: string,
  ) {
    return this.uploadService.upload(file, folder);
  }

  @Post('multiple')
  @UseInterceptors(
    FilesInterceptor('files', MAX_MULTIPLE_FILES, {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
        folder: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload multiple files (max 10, 5MB each)' })
  @ApiResponse({ status: 201, description: 'Files uploaded' })
  async uploadMultiple(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({
            fileType: ALLOWED_MIME_REGEX,
          }),
        ],
        fileIsRequired: true,
      }),
    )
    files: Express.Multer.File[],
    @Body('folder') folder?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    return Promise.all(files.map(file => this.uploadService.upload(file, folder)));
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete an uploaded file by key' })
  @ApiResponse({ status: 200, description: 'File deleted' })
  async deleteFile(@Param('key') key: string) {
    await this.uploadService.delete(key);
    return { message: 'File deleted' };
  }
}
