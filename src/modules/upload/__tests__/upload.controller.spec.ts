import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { UploadController } from '../upload.controller';
import { UploadService } from '../upload.service';
import type { UploadedFileInfo } from '../storage-provider.interface';

describe('UploadController', () => {
  let controller: UploadController;
  let uploadService: UploadService;

  const mockUploadService = {
    upload: jest.fn(),
    delete: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test-image.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('test-content'),
    stream: {} as any,
    destination: '',
    filename: '',
    path: '',
  };

  const mockUploadedFileInfo: UploadedFileInfo = {
    url: '/uploads/general/abc123.png',
    key: 'general/abc123.png',
    filename: 'test-image.png',
    mimetype: 'image/png',
    size: 1024,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
      if (key === 'MAX_FILE_SIZE') return defaultValue;
      if (key === 'ALLOWED_MIME_TYPES') return defaultValue;
      return defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        { provide: UploadService, useValue: mockUploadService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<UploadController>(UploadController);
    uploadService = module.get<UploadService>(UploadService);
  });

  describe('uploadFile', () => {
    it('deve fazer upload de arquivo com sucesso', async () => {
      mockUploadService.upload.mockResolvedValue(mockUploadedFileInfo);

      const result = await controller.uploadFile(mockFile, 'avatars');

      expect(result).toEqual(mockUploadedFileInfo);
      expect(uploadService.upload).toHaveBeenCalledWith(mockFile, 'avatars');
    });

    it('deve fazer upload sem pasta especificada', async () => {
      mockUploadService.upload.mockResolvedValue(mockUploadedFileInfo);

      const result = await controller.uploadFile(mockFile);

      expect(result).toEqual(mockUploadedFileInfo);
      expect(uploadService.upload).toHaveBeenCalledWith(mockFile, undefined);
    });
  });

  describe('uploadMultiple', () => {
    it('deve fazer upload de m\u00faltiplos arquivos com sucesso', async () => {
      const files = [
        { ...mockFile, originalname: 'file1.png' },
        { ...mockFile, originalname: 'file2.png' },
      ];

      mockUploadService.upload
        .mockResolvedValueOnce({ ...mockUploadedFileInfo, key: 'general/file1.png' })
        .mockResolvedValueOnce({ ...mockUploadedFileInfo, key: 'general/file2.png' });

      const result = await controller.uploadMultiple(files, 'products');

      expect(result).toHaveLength(2);
      expect(uploadService.upload).toHaveBeenCalledTimes(2);
      expect(uploadService.upload).toHaveBeenCalledWith(files[0], 'products');
      expect(uploadService.upload).toHaveBeenCalledWith(files[1], 'products');
    });

    it('deve lan\u00e7ar BadRequestException quando array de arquivos est\u00e1 vazio', async () => {
      await expect(controller.uploadMultiple([])).rejects.toThrow(
        new BadRequestException('No files provided'),
      );
      expect(uploadService.upload).not.toHaveBeenCalled();
    });

    it('deve lan\u00e7ar BadRequestException quando files \u00e9 null', async () => {
      await expect(controller.uploadMultiple(null as any)).rejects.toThrow(
        new BadRequestException('No files provided'),
      );
      expect(uploadService.upload).not.toHaveBeenCalled();
    });

    it('deve fazer upload m\u00faltiplos sem pasta especificada', async () => {
      const files = [{ ...mockFile, originalname: 'file1.png' }];
      mockUploadService.upload.mockResolvedValue(mockUploadedFileInfo);

      const result = await controller.uploadMultiple(files);

      expect(result).toHaveLength(1);
      expect(uploadService.upload).toHaveBeenCalledWith(files[0], undefined);
    });
  });

  describe('deleteFile', () => {
    it('deve deletar arquivo com sucesso', async () => {
      mockUploadService.delete.mockResolvedValue(undefined);

      const result = await controller.deleteFile('general/test-file.png');

      expect(result).toEqual({ message: 'File deleted' });
      expect(uploadService.delete).toHaveBeenCalledWith('general/test-file.png');
    });

    it('deve deletar arquivo com chave simples', async () => {
      mockUploadService.delete.mockResolvedValue(undefined);

      const result = await controller.deleteFile('simple-key.jpg');

      expect(result).toEqual({ message: 'File deleted' });
      expect(uploadService.delete).toHaveBeenCalledWith('simple-key.jpg');
    });
  });
});
