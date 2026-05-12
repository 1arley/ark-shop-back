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

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERADMIN')
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
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
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body('folder') folder?: string) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.uploadService.upload(file, folder);
  }

  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
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
  @ApiOperation({ summary: 'Upload multiple files (max 10)' })
  @ApiResponse({ status: 201, description: 'Files uploaded' })
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
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
