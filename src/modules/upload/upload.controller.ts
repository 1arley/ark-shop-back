import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
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
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';
import { ConfigService } from '@nestjs/config';

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERADMIN')
@ApiBearerAuth()
export class UploadController {
  private readonly maxFileSize: number;
  private readonly allowedMimes: string[];

  constructor(
    private readonly uploadService: UploadService,
    private readonly configService: ConfigService,
  ) {
    this.maxFileSize = this.configService.get<number>('MAX_FILE_SIZE', 5 * 1024 * 1024);
    this.allowedMimes = this.configService
      .get<string>('ALLOWED_MIME_TYPES', 'image/jpeg,image/png,image/webp,image/gif')
      .split(',');
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — reject early at Multer level
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
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /image\/(jpeg|png|webp|gif)/,
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
    FilesInterceptor('files', 10, {
      limits: { fileSize: 5 * 1024 * 1024 },
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
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /image\/(jpeg|png|webp|gif)/,
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
