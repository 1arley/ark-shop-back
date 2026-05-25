import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { LocalStorageProvider } from '../providers/local-storage.provider';
import * as fs from 'fs/promises';

jest.mock('fs/promises');
jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-12345'),
}));

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;

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

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
      if (key === 'UPLOAD_DIR') return defaultValue || './uploads';
      if (key === 'UPLOAD_BASE_URL') return defaultValue || '/uploads';
      return defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalStorageProvider, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    provider = module.get<LocalStorageProvider>(LocalStorageProvider);
  });

  describe('upload', () => {
    it('deve fazer upload com sucesso', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await provider.upload(mockFile, 'avatars');

      expect(result).toEqual({
        url: '/uploads/avatars/test-uuid-12345.png',
        key: 'avatars/test-uuid-12345.png',
        filename: 'test-image.png',
        mimetype: 'image/png',
        size: 1024,
      });
    });

    it('deve criar diret\u00f3rio com recursive: true', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await provider.upload(mockFile, 'nested/deep/folder');

      expect(fs.mkdir).toHaveBeenCalled();
      const mkdirCall = (fs.mkdir as jest.Mock).mock.calls[0];
      expect(mkdirCall[1]).toEqual({ recursive: true });
    });

    it('deve gerar nome de arquivo UUID com extens\u00e3o original', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const jpgFile = { ...mockFile, originalname: 'photo.jpg' };
      const result = await provider.upload(jpgFile);

      expect(result.key).toBe('general/test-uuid-12345.jpg');
      expect(result.url).toBe('/uploads/general/test-uuid-12345.jpg');
    });

    it('deve usar pasta padr\u00e3o "general" quando n\u00e3o fornecida', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await provider.upload(mockFile);

      expect(result.key).toContain('general/');
    });

    it('deve sanitizar nome da pasta removendo caracteres perigosos', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await provider.upload(mockFile, '../etc/passwd');

      // sanitizeSegment remove '..' e '/', resultando em 'etcpasswd'
      expect(result.key).not.toContain('../');
    });

    it('deve escrever o buffer do arquivo no disco', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await provider.upload(mockFile);

      expect(fs.writeFile).toHaveBeenCalled();
      const writeFileCall = (fs.writeFile as jest.Mock).mock.calls[0];
      expect(writeFileCall[1]).toEqual(mockFile.buffer);
    });
  });

  describe('delete', () => {
    it('deve deletar arquivo com sucesso', async () => {
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await provider.delete('general/test-uuid-12345.png');

      expect(fs.unlink).toHaveBeenCalled();
    });

    it('n\u00e3o deve lan\u00e7ar erro quando arquivo n\u00e3o existe (apenas log warning)', async () => {
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(provider.delete('general/nonexistent.png')).resolves.toBeUndefined();
    });

    it('deve sanitizar path ao deletar', async () => {
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await provider.delete('general/test-uuid-12345.png');

      expect(fs.unlink).toHaveBeenCalled();
      const unlinkCall = (fs.unlink as jest.Mock).mock.calls[0];
      const unlinkPath = unlinkCall[0] as string;
      expect(unlinkPath).not.toContain('..');
    });

    it('deve preservar extens\u00e3o do arquivo ao sanitizar path de dele\u00e7\u00e3o', async () => {
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await provider.delete('avatars/test-uuid.png');

      const unlinkCall = (fs.unlink as jest.Mock).mock.calls[0];
      const unlinkPath = unlinkCall[0] as string;
      expect(unlinkPath).toContain('.png');
    });
  });

  describe('sanitizePath (via teste indireto)', () => {
    it('deve sanitizar pasta maliciosa via upload', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const result = await provider.upload(mockFile, '../../../etc');

      // O sanitizeSegment remove '..' e '/', resultando em 'etc'
      expect(result.key).not.toContain('..');
    });

    it('deve lan\u00e7ar BadRequestException quando path sanitizado sai do diret\u00f3rio base', async () => {
      // Acessando m\u00e9todo privado para testar diretamente
      const providerAny = provider as any;

      expect(() => providerAny.sanitizePath(['../../../etc'])).toThrow(BadRequestException);
    });

    it('deve aceitar path v\u00e1lido dentro do diret\u00f3rio base', async () => {
      const providerAny = provider as any;

      const result = providerAny.sanitizePath(['avatars']);
      expect(result).toBeDefined();
      expect(result).toContain('avatars');
    });
  });

  describe('sanitizeSegment', () => {
    it('deve remover caracteres perigosos preservando alfanum\u00e9ricos, h\u00edfen e underscore', () => {
      const providerAny = provider as any;

      expect(providerAny.sanitizeSegment('safe-name_123')).toBe('safe-name_123');
    });

    it('deve remover ".." do segmento', () => {
      const providerAny = provider as any;

      expect(providerAny.sanitizeSegment('../etc')).toBe('etc');
    });

    it('deve remover barras do segmento', () => {
      const providerAny = provider as any;

      expect(providerAny.sanitizeSegment('path/to/file')).toBe('pathtofile');
    });

    it('deve remover caracteres especiais (incluindo ponto)', () => {
      const providerAny = provider as any;

      // O regex [^a-zA-Z0-9_-] remove o ponto tamb\u00e9m
      expect(providerAny.sanitizeSegment('file@#$%^&*.png')).toBe('filepng');
    });

    it('deve remover espa\u00e7os', () => {
      const providerAny = provider as any;

      expect(providerAny.sanitizeSegment('my file name')).toBe('myfilename');
    });

    it('deve preservar h\u00edfen e underscore', () => {
      const providerAny = provider as any;

      expect(providerAny.sanitizeSegment('my-file_name')).toBe('my-file_name');
    });

    it('deve retornar string vazia para segmento totalmente inv\u00e1lido', () => {
      const providerAny = provider as any;

      expect(providerAny.sanitizeSegment('../../')).toBe('');
    });
  });
});
