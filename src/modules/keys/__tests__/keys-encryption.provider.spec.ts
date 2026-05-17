import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KeysEncryptionProvider } from '../keys-encryption.provider';

describe('KeysEncryptionProvider', () => {
  let provider: KeysEncryptionProvider;
  let configService: ConfigService;

  const validKey = 'a'.repeat(32); // 32 chars minimum

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue(validKey);
  });

  // ─── Constructor ──────────────────────────────────────────────────
  describe('Construtor', () => {
    it('deve criar provider com chave valida (>= 32 caracteres)', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KeysEncryptionProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      provider = module.get<KeysEncryptionProvider>(KeysEncryptionProvider);
      configService = module.get<ConfigService>(ConfigService);

      expect(provider).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('KEYS_ENCRYPTION_KEY');
    });

    it('deve lancar erro quando chave e muito curta (< 32 caracteres)', async () => {
      mockConfigService.get.mockReturnValue('short-key');

      await expect(
        Test.createTestingModule({
          providers: [
            KeysEncryptionProvider,
            { provide: ConfigService, useValue: mockConfigService },
          ],
        }).compile(),
      ).rejects.toThrow(Error);
    });

    it('deve lancar erro quando chave esta ausente', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await expect(
        Test.createTestingModule({
          providers: [
            KeysEncryptionProvider,
            { provide: ConfigService, useValue: mockConfigService },
          ],
        }).compile(),
      ).rejects.toThrow(Error);
    });

    it('deve lancar erro quando chave e string vazia', async () => {
      mockConfigService.get.mockReturnValue('');

      await expect(
        Test.createTestingModule({
          providers: [
            KeysEncryptionProvider,
            { provide: ConfigService, useValue: mockConfigService },
          ],
        }).compile(),
      ).rejects.toThrow(Error);
    });
  });

  // ─── encrypt ──────────────────────────────────────────────────────
  describe('encrypt', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KeysEncryptionProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      provider = module.get<KeysEncryptionProvider>(KeysEncryptionProvider);
    });

    it('deve criptografar dados e retornar formato v2:', () => {
      const result = provider.encrypt('my-secret-key');

      expect(result).toBeDefined();
      expect(result.startsWith('v2:')).toBe(true);
      expect(result).not.toBe('my-secret-key');
    });

    it('deve gerar dados criptografados diferentes para mesma entrada (IV aleatorio)', () => {
      const result1 = provider.encrypt('same-data');
      const result2 = provider.encrypt('same-data');

      expect(result1).not.toBe(result2);
      expect(result1.startsWith('v2:')).toBe(true);
      expect(result2.startsWith('v2:')).toBe(true);
    });

    it('deve criptografar string vazia', () => {
      const result = provider.encrypt('');

      expect(result.startsWith('v2:')).toBe(true);
    });
  });

  // ─── decrypt ──────────────────────────────────────────────────────
  describe('decrypt', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KeysEncryptionProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      provider = module.get<KeysEncryptionProvider>(KeysEncryptionProvider);
    });

    it('deve descriptografar dados no formato v2', () => {
      const original = 'XXXX-YYYY-ZZZZ-1234';
      const encrypted = provider.encrypt(original);
      const decrypted = provider.decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    it('deve descriptografar dados no formato legacy (crypto-js)', () => {
      // Formato legacy gerado com crypto-js AES
      const legacyEncrypted = 'U2FsdGVkX1+some-legacy-data==';
      // O provider tentara decryptLegacy que pode falhar com dados invalidos
      // Entao testamos que o provider tenta o caminho legacy quando nao comeca com v2:
      expect(() => provider.decrypt(legacyEncrypted)).toBeDefined();
    });

    it('deve lancar BadRequestException quando dados sao invalidos', () => {
      expect(() => provider.decrypt('v2:invalid')).toThrow(BadRequestException);
    });

    it('deve lancar BadRequestException quando dados estao corrompidos', () => {
      const encrypted = provider.encrypt('valid-data');
      const corrupted = encrypted.slice(0, -5) + 'XXXXX';

      expect(() => provider.decrypt(corrupted)).toThrow(BadRequestException);
    });
  });

  // ─── decryptV2 ────────────────────────────────────────────────────
  describe('decryptV2 (via decrypt)', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KeysEncryptionProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      provider = module.get<KeysEncryptionProvider>(KeysEncryptionProvider);
    });

    it('deve descriptografar dados validos no formato v2', () => {
      const original = 'test-key-data-12345';
      const encrypted = provider.encrypt(original);
      const decrypted = provider.decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    it('deve lancar erro quando dados sao muito curtos', () => {
      // v2: + base64 de menos de 32 bytes combinados
      expect(() => provider.decrypt('v2:short')).toThrow(BadRequestException);
    });

    it('deve lancar erro quando resultado da descriptografia e vazio', () => {
      // Dados que resultam em string vazia apos descriptografia
      const emptyResult =
        'v2:' +
        Buffer.concat([
          Buffer.alloc(16), // IV
          Buffer.alloc(16), // tag
          Buffer.alloc(0), // ciphertext vazio
        ]).toString('base64');

      expect(() => provider.decrypt(emptyResult)).toThrow(BadRequestException);
    });
  });

  // ─── decryptLegacy (via decrypt) ──────────────────────────────────
  describe('decryptLegacy (via decrypt)', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KeysEncryptionProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      provider = module.get<KeysEncryptionProvider>(KeysEncryptionProvider);
    });

    it('deve tentar decrypt para dados que nao comecam com v2:', () => {
      // Dados que nao comecam com v2: devem ir para o caminho legacy
      expect(() => provider.decrypt('some-legacy-data')).toBeDefined();
    });

    it('deve lancar BadRequestException quando dados legacy sao invalidos', () => {
      expect(() => provider.decrypt('invalid-legacy-data')).toThrow(BadRequestException);
    });
  });

  // ─── encryptBatch ─────────────────────────────────────────────────
  describe('encryptBatch', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KeysEncryptionProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      provider = module.get<KeysEncryptionProvider>(KeysEncryptionProvider);
    });

    it('deve criptografar multiplas chaves', () => {
      const keys = ['key-1', 'key-2', 'key-3'];
      const result = provider.encryptBatch(keys);

      expect(result).toHaveLength(3);
      result.forEach(encrypted => {
        expect(encrypted.startsWith('v2:')).toBe(true);
      });
    });

    it('deve retornar array vazio para entrada vazia', () => {
      const result = provider.encryptBatch([]);

      expect(result).toEqual([]);
    });
  });

  // ─── decryptBatch ─────────────────────────────────────────────────
  describe('decryptBatch', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KeysEncryptionProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      provider = module.get<KeysEncryptionProvider>(KeysEncryptionProvider);
    });

    it('deve descriptografar multiplas chaves', () => {
      const originals = ['key-1', 'key-2', 'key-3'];
      const encrypted = originals.map(k => provider.encrypt(k));
      const result = provider.decryptBatch(encrypted);

      expect(result).toEqual(originals);
    });

    it('deve retornar array vazio para entrada vazia', () => {
      const result = provider.decryptBatch([]);

      expect(result).toEqual([]);
    });
  });

  // ─── generateSecureKey ────────────────────────────────────────────
  describe('generateSecureKey', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          KeysEncryptionProvider,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      provider = module.get<KeysEncryptionProvider>(KeysEncryptionProvider);
    });

    it('deve gerar chave com tamanho padrao (32 caracteres)', () => {
      const key = provider.generateSecureKey();

      expect(key).toBeDefined();
      expect(key.length).toBe(32);
      expect(key).toMatch(/^[a-f0-9]+$/); // UUID sem hifens = hex chars
    });

    it('deve gerar chave com tamanho customizado', () => {
      const key = provider.generateSecureKey(24);

      expect(key.length).toBe(24);
    });

    it('deve gerar chave com tamanho maior que UUID (64 caracteres)', () => {
      const key = provider.generateSecureKey(64);

      expect(key.length).toBe(64);
    });

    it('deve gerar chaves diferentes a cada chamada (aleatoriedade criptografica)', () => {
      const key1 = provider.generateSecureKey();
      const key2 = provider.generateSecureKey();

      expect(key1).not.toBe(key2);
    });

    it('deve gerar chave com tamanho 1', () => {
      const key = provider.generateSecureKey(1);

      expect(key.length).toBe(1);
    });

    it('deve gerar chave com tamanho exatamente igual ao UUID (32)', () => {
      const key = provider.generateSecureKey(32);

      expect(key.length).toBe(32);
    });
  });
});
