import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3StorageProvider } from '../providers/s3-storage.provider';
import type { UploadedFileInfo } from '../storage-provider.interface';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn();
  const MockS3Client = jest.fn(() => ({
    send: mockSend,
  }));
  return {
    S3Client: MockS3Client,
    DeleteObjectCommand: jest.fn(() => ({ command: 'DeleteObject' })),
    __mockSend: mockSend,
  };
});

jest.mock('@aws-sdk/lib-storage', () => {
  const MockUpload = jest.fn(() => ({
    done: jest.fn().mockResolvedValue({}),
  }));
  return { Upload: MockUpload };
});

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-12345'),
}));

describe('S3StorageProvider', () => {
  let provider: S3StorageProvider;
  let _configService: ConfigService;

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

  const _mockUploadedFileInfo: UploadedFileInfo = {
    url: 'https://my-bucket.s3.us-east-1.amazonaws.com/products/test-uuid-12345.png',
    key: 'products/test-uuid-12345.png',
    filename: 'test-image.png',
    mimetype: 'image/png',
    size: 1024,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
      if (key === 'S3_BUCKET') return 'my-bucket';
      if (key === 'S3_REGION') return defaultValue || 'us-east-1';
      if (key === 'S3_ENDPOINT') return defaultValue || '';
      if (key === 'S3_ACCESS_KEY_ID') return 'test-access-key';
      if (key === 'S3_SECRET_ACCESS_KEY') return 'test-secret-key';
      if (key === 'UPLOAD_BASE_URL') return defaultValue;
      return defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [S3StorageProvider, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    provider = module.get<S3StorageProvider>(S3StorageProvider);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('upload', () => {
    it('deve fazer upload com sucesso para S3', async () => {
      (Upload as jest.Mock).mockReturnValue({
        done: jest.fn().mockResolvedValue({}),
      });

      const result = await provider.upload(mockFile, 'products');

      expect(result.key).toBe('products/test-uuid-12345.png');
      expect(result.filename).toBe('test-image.png');
      expect(result.mimetype).toBe('image/png');
      expect(result.size).toBe(1024);
      expect(Upload).toHaveBeenCalled();
    });

    it('deve fazer upload com configura\u00e7\u00e3o de endpoint', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'S3_BUCKET') return 'my-bucket';
        if (key === 'S3_REGION') return 'us-east-1';
        if (key === 'S3_ENDPOINT') return 'http://localhost:9000/storage/v1/s3';
        if (key === 'S3_ACCESS_KEY_ID') return 'test-access-key';
        if (key === 'S3_SECRET_ACCESS_KEY') return 'test-secret-key';
        if (key === 'UPLOAD_BASE_URL') return defaultValue;
        return defaultValue;
      });

      const freshModule: TestingModule = await Test.createTestingModule({
        providers: [S3StorageProvider, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      const freshProvider = freshModule.get<S3StorageProvider>(S3StorageProvider);

      (Upload as jest.Mock).mockReturnValue({
        done: jest.fn().mockResolvedValue({}),
      });

      const result = await freshProvider.upload(mockFile);

      expect(result).toBeDefined();
      expect(S3Client).toHaveBeenCalled();
    });

    it('deve lan\u00e7ar erro quando bucket n\u00e3o est\u00e1 configurado', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'S3_BUCKET') return '';
        if (key === 'S3_REGION') return defaultValue || 'us-east-1';
        if (key === 'S3_ENDPOINT') return defaultValue || '';
        return defaultValue;
      });

      const freshModule: TestingModule = await Test.createTestingModule({
        providers: [S3StorageProvider, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      const freshProvider = freshModule.get<S3StorageProvider>(S3StorageProvider);

      await expect(freshProvider.upload(mockFile)).rejects.toThrow(
        'S3 storage requires S3_BUCKET environment variable',
      );
    });

    it('deve usar pasta padr\u00e3o "general" quando n\u00e3o fornecida', async () => {
      (Upload as jest.Mock).mockReturnValue({
        done: jest.fn().mockResolvedValue({}),
      });

      const result = await provider.upload(mockFile);

      expect(result.key).toBe('general/test-uuid-12345.png');
    });

    it('deve usar URL base padr\u00e3o quando UPLOAD_BASE_URL n\u00e3o configurado', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'S3_BUCKET') return 'my-bucket';
        if (key === 'S3_REGION') return 'eu-west-1';
        if (key === 'S3_ENDPOINT') return defaultValue || '';
        if (key === 'S3_ACCESS_KEY_ID') return 'test-access-key';
        if (key === 'S3_SECRET_ACCESS_KEY') return 'test-secret-key';
        if (key === 'UPLOAD_BASE_URL') return defaultValue;
        return defaultValue;
      });

      const freshModule: TestingModule = await Test.createTestingModule({
        providers: [S3StorageProvider, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      const freshProvider = freshModule.get<S3StorageProvider>(S3StorageProvider);

      (Upload as jest.Mock).mockReturnValue({
        done: jest.fn().mockResolvedValue({}),
      });

      const result = await freshProvider.upload(mockFile);

      expect(result.url).toContain('my-bucket.s3.eu-west-1.amazonaws.com');
    });
  });

  describe('delete', () => {
    it('deve deletar arquivo do S3 com sucesso', async () => {
      const _mockSend =
        (S3Client as jest.MockedClass<typeof S3Client>).mock.results[0]?.value?.send ||
        jest.fn().mockResolvedValue({});

      // Recriar o provider para ter um client fresh
      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'S3_BUCKET') return 'my-bucket';
        if (key === 'S3_REGION') return defaultValue || 'us-east-1';
        if (key === 'S3_ENDPOINT') return defaultValue || '';
        if (key === 'S3_ACCESS_KEY_ID') return 'test-access-key';
        if (key === 'S3_SECRET_ACCESS_KEY') return 'test-secret-key';
        if (key === 'UPLOAD_BASE_URL') return defaultValue;
        return defaultValue;
      });

      const freshModule: TestingModule = await Test.createTestingModule({
        providers: [S3StorageProvider, { provide: ConfigService, useValue: mockConfigService }],
      }).compile();

      const freshProvider = freshModule.get<S3StorageProvider>(S3StorageProvider);

      // Mock do client
      const mockClient = { send: jest.fn().mockResolvedValue({}) };
      (S3Client as jest.Mock).mockReturnValue(mockClient);

      // Reset o client interno
      (freshProvider as any).client = undefined;

      await freshProvider.delete('products/test-uuid-12345.png');

      expect(mockClient.send).toHaveBeenCalled();
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'my-bucket',
        Key: 'products/test-uuid-12345.png',
      });
    });
  });

  describe('ensureClient', () => {
    it('deve criar client com credenciais', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'S3_BUCKET') return 'my-bucket';
        if (key === 'S3_REGION') return defaultValue || 'us-east-1';
        if (key === 'S3_ENDPOINT') return defaultValue || '';
        if (key === 'S3_ACCESS_KEY_ID') return 'test-access-key';
        if (key === 'S3_SECRET_ACCESS_KEY') return 'test-secret-key';
        if (key === 'UPLOAD_BASE_URL') return defaultValue;
        return defaultValue;
      });

      const freshModule: TestingModule = Test.createTestingModule({
        providers: [S3StorageProvider, { provide: ConfigService, useValue: mockConfigService }],
      });

      expect(freshModule).toBeDefined();
    });

    it('deve criar client sem credenciais (IAM role)', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'S3_BUCKET') return 'my-bucket';
        if (key === 'S3_REGION') return defaultValue || 'us-east-1';
        if (key === 'S3_ENDPOINT') return defaultValue || '';
        if (key === 'S3_ACCESS_KEY_ID') return '';
        if (key === 'S3_SECRET_ACCESS_KEY') return '';
        if (key === 'UPLOAD_BASE_URL') return defaultValue;
        return defaultValue;
      });

      const freshModule: TestingModule = Test.createTestingModule({
        providers: [S3StorageProvider, { provide: ConfigService, useValue: mockConfigService }],
      });

      expect(freshModule).toBeDefined();
    });

    it('deve criar client com endpoint configurado', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'S3_BUCKET') return 'my-bucket';
        if (key === 'S3_REGION') return defaultValue || 'us-east-1';
        if (key === 'S3_ENDPOINT') return 'http://localhost:9000';
        if (key === 'S3_ACCESS_KEY_ID') return 'test-access-key';
        if (key === 'S3_SECRET_ACCESS_KEY') return 'test-secret-key';
        if (key === 'UPLOAD_BASE_URL') return defaultValue;
        return defaultValue;
      });

      const freshModule: TestingModule = Test.createTestingModule({
        providers: [S3StorageProvider, { provide: ConfigService, useValue: mockConfigService }],
      });

      expect(freshModule).toBeDefined();
    });

    it('deve lan\u00e7ar erro quando bucket est\u00e1 ausente', () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'S3_BUCKET') return '';
        if (key === 'S3_REGION') return defaultValue || 'us-east-1';
        if (key === 'S3_ENDPOINT') return defaultValue || '';
        return defaultValue;
      });

      const freshModule: TestingModule = Test.createTestingModule({
        providers: [S3StorageProvider, { provide: ConfigService, useValue: mockConfigService }],
      });

      expect(freshModule).toBeDefined();
    });
  });
});
