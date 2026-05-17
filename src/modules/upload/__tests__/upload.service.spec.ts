import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UploadService } from '../upload.service';
import { LocalStorageProvider } from '../providers/local-storage.provider';
import { S3StorageProvider } from '../providers/s3-storage.provider';
import type { UploadedFileInfo } from '../storage-provider.interface';

describe('UploadService', () => {
  let _service: UploadService;
  let _configService: ConfigService;
  let _localStorageProvider: LocalStorageProvider;
  let _s3StorageProvider: S3StorageProvider;

  const mockLocalStorageProvider = {
    upload: jest.fn(),
    delete: jest.fn(),
  };

  const mockS3StorageProvider = {
    upload: jest.fn(),
    delete: jest.fn(),
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

  function createMockConfigService(overrides: Record<string, any> = {}) {
    return {
      get: jest.fn((key: string, defaultValue: any) => {
        if (key in overrides) return overrides[key];
        if (key === 'STORAGE_DRIVER') return defaultValue || 'local';
        if (key === 'MAX_FILE_SIZE') return defaultValue;
        if (key === 'ALLOWED_MIME_TYPES') return defaultValue;
        return defaultValue;
      }),
    };
  }

  async function createServiceModule(configOverrides: Record<string, any> = {}) {
    const cfg = createMockConfigService(configOverrides);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: ConfigService, useValue: cfg },
        { provide: LocalStorageProvider, useValue: mockLocalStorageProvider },
        { provide: S3StorageProvider, useValue: mockS3StorageProvider },
      ],
    }).compile();
    return {
      module,
      service: module.get<UploadService>(UploadService),
      configService: cfg,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('construtor', () => {
    it('deve inicializar com driver local por padr\u00e3o', async () => {
      const { service: localService } = await createServiceModule();
      expect(localService).toBeDefined();
    });

    it('deve selecionar S3StorageProvider quando driver for s3', async () => {
      const { service: s3Service } = await createServiceModule({ STORAGE_DRIVER: 's3' });
      expect(s3Service).toBeDefined();
    });
  });

  describe('upload', () => {
    it('deve fazer upload com sucesso usando driver local', async () => {
      mockLocalStorageProvider.upload.mockResolvedValue(mockUploadedFileInfo);
      const { service: localService } = await createServiceModule();

      const result = await localService.upload(mockFile, 'avatars');

      expect(result).toEqual(mockUploadedFileInfo);
      expect(mockLocalStorageProvider.upload).toHaveBeenCalledWith(mockFile, 'avatars');
    });

    it('deve fazer upload com sucesso usando driver S3', async () => {
      mockS3StorageProvider.upload.mockResolvedValue(mockUploadedFileInfo);
      const { service: s3Service } = await createServiceModule({ STORAGE_DRIVER: 's3' });

      const result = await s3Service.upload(mockFile, 'products');

      expect(result).toEqual(mockUploadedFileInfo);
      expect(mockS3StorageProvider.upload).toHaveBeenCalledWith(mockFile, 'products');
    });

    it('deve usar pasta padr\u00e3o "general" quando n\u00e3o fornecida', async () => {
      mockLocalStorageProvider.upload.mockResolvedValue(mockUploadedFileInfo);
      const { service: localService } = await createServiceModule();

      await localService.upload(mockFile);

      expect(mockLocalStorageProvider.upload).toHaveBeenCalledWith(mockFile, 'general');
    });

    it('deve lan\u00e7ar erro quando arquivo \u00e9 muito grande', async () => {
      const { service: localService } = await createServiceModule({ MAX_FILE_SIZE: 500 });

      const largeFile = { ...mockFile, size: 1024 };

      await expect(localService.upload(largeFile)).rejects.toThrow(
        'Arquivo muito grande. Tamanho m\u00e1ximo: 0.000476837158203125MB',
      );
      expect(mockLocalStorageProvider.upload).not.toHaveBeenCalled();
    });

    it('deve lan\u00e7ar erro quando tipo MIME n\u00e3o \u00e9 permitido', async () => {
      const { service: localService } = await createServiceModule({
        ALLOWED_MIME_TYPES: 'image/jpeg,image/png',
      });

      const invalidFile = { ...mockFile, mimetype: 'application/pdf' };

      await expect(localService.upload(invalidFile)).rejects.toThrow(
        'Tipo de arquivo n\u00e3o permitido: application/pdf',
      );
      expect(mockLocalStorageProvider.upload).not.toHaveBeenCalled();
    });

    it('deve lan\u00e7ar erro quando nenhum arquivo \u00e9 enviado', async () => {
      const { service: localService } = await createServiceModule();

      await expect(localService.upload(null as any)).rejects.toThrow('Nenhum arquivo enviado.');
      expect(mockLocalStorageProvider.upload).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deve deletar arquivo com sucesso', async () => {
      mockLocalStorageProvider.delete.mockResolvedValue(undefined);
      const { service: localService } = await createServiceModule();

      await localService.delete('general/test-file.png');

      expect(mockLocalStorageProvider.delete).toHaveBeenCalledWith('general/test-file.png');
    });
  });

  describe('validateFile (casos de valida\u00e7\u00e3o)', () => {
    it('deve validar arquivo com tamanho exatamente no limite', async () => {
      mockLocalStorageProvider.upload.mockResolvedValue(mockUploadedFileInfo);
      const { service: localService } = await createServiceModule({ MAX_FILE_SIZE: 1024 });

      const exactSizeFile = { ...mockFile, size: 1024 };

      const result = await localService.upload(exactSizeFile);
      expect(result).toEqual(mockUploadedFileInfo);
    });

    it('deve validar arquivo com tamanho 1 byte acima do limite', async () => {
      const { service: localService } = await createServiceModule({ MAX_FILE_SIZE: 1024 });

      const overLimitFile = { ...mockFile, size: 1025 };

      await expect(localService.upload(overLimitFile)).rejects.toThrow('Arquivo muito grande');
    });

    it('deve validar todos os tipos MIME permitidos', async () => {
      mockLocalStorageProvider.upload.mockResolvedValue(mockUploadedFileInfo);
      const { service: localService } = await createServiceModule({
        ALLOWED_MIME_TYPES: 'image/jpeg,image/png,image/webp,image/gif',
      });

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

      for (const mime of allowedTypes) {
        const file = { ...mockFile, mimetype: mime };
        await expect(localService.upload(file)).resolves.toBeDefined();
      }
    });
  });
});
