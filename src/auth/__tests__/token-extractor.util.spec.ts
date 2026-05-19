import { cookieOrBearerExtractor, extractRefreshToken } from '@/auth/token-extractor.util';

describe('Token Extractor Utilities', () => {
  describe('cookieOrBearerExtractor', () => {
    it('deve retornar token do cookie quando presente', () => {
      const mockReq = {
        cookies: { access_token: 'cookie-token-value' },
        headers: { authorization: 'Bearer header-token-value' },
        get: jest.fn(),
      } as any;

      const result = cookieOrBearerExtractor(mockReq);

      expect(result).toBe('cookie-token-value');
    });

    it('deve retornar token do Bearer header quando cookie nao esta presente', () => {
      const mockReq = {
        cookies: {},
        headers: { authorization: 'Bearer header-token-value' },
        get: jest.fn(),
      } as any;

      const result = cookieOrBearerExtractor(mockReq);

      expect(result).toBe('header-token-value');
    });

    it('deve priorizar cookie quando ambos cookie e Bearer header estao presentes', () => {
      const mockReq = {
        cookies: { access_token: 'cookie-token-value' },
        headers: { authorization: 'Bearer header-token-value' },
        get: jest.fn(),
      } as any;

      const result = cookieOrBearerExtractor(mockReq);

      expect(result).toBe('cookie-token-value');
    });

    it('deve retornar null quando nem cookie nem Bearer header estao presentes', () => {
      const mockReq = {
        cookies: {},
        headers: {},
        get: jest.fn(),
      } as any;

      const result = cookieOrBearerExtractor(mockReq);

      expect(result).toBeNull();
    });

    it('deve retornar null quando cookies e undefined', () => {
      const mockReq = {
        headers: {},
        get: jest.fn(),
      } as any;

      const result = cookieOrBearerExtractor(mockReq);

      expect(result).toBeNull();
    });

    it('deve retornar null quando cookie access_token esta vazio', () => {
      const mockReq = {
        cookies: { access_token: '' },
        headers: {},
        get: jest.fn(),
      } as any;

      const result = cookieOrBearerExtractor(mockReq);

      // Empty string is falsy, so it falls through to Bearer check
      expect(result).toBeNull();
    });

    it('deve retornar null quando Authorization header nao e Bearer', () => {
      const mockReq = {
        cookies: {},
        headers: { authorization: 'Basic some-credentials' },
        get: jest.fn(),
      } as any;

      const result = cookieOrBearerExtractor(mockReq);

      expect(result).toBeNull();
    });
  });

  describe('extractRefreshToken', () => {
    it('deve retornar token do cookie refresh_token quando presente', () => {
      const mockReq = {
        cookies: { refresh_token: 'cookie-refresh-token' },
        get: jest.fn(),
      } as any;

      const result = extractRefreshToken(mockReq);

      expect(result).toBe('cookie-refresh-token');
      expect(mockReq.get).not.toHaveBeenCalled();
    });

    it('deve retornar token do header x-refresh-token quando cookie nao esta presente', () => {
      const mockReq = {
        cookies: {},
        get: jest.fn().mockReturnValue('header-refresh-token'),
      } as any;

      const result = extractRefreshToken(mockReq);

      expect(result).toBe('header-refresh-token');
      expect(mockReq.get).toHaveBeenCalledWith('x-refresh-token');
    });

    it('deve priorizar cookie quando ambos cookie e header estao presentes', () => {
      const mockReq = {
        cookies: { refresh_token: 'cookie-refresh-token' },
        get: jest.fn().mockReturnValue('header-refresh-token'),
      } as any;

      const result = extractRefreshToken(mockReq);

      expect(result).toBe('cookie-refresh-token');
      expect(mockReq.get).not.toHaveBeenCalled();
    });

    it('deve retornar token do Authorization Bearer quando cookie e header ausentes', () => {
      const mockReq = {
        cookies: {},
        get: jest.fn().mockReturnValue(undefined),
        headers: { authorization: 'Bearer bearer-refresh-token' },
      } as any;

      const result = extractRefreshToken(mockReq);

      expect(result).toBe('bearer-refresh-token');
    });

    it('deve retornar null quando nem cookie nem header estao presentes', () => {
      const mockReq = {
        cookies: {},
        get: jest.fn().mockReturnValue(undefined),
        headers: {},
      } as any;

      const result = extractRefreshToken(mockReq);

      expect(result).toBeNull();
    });

    it('deve retornar null quando cookies e undefined', () => {
      const mockReq = {
        get: jest.fn().mockReturnValue(undefined),
      } as any;

      const result = extractRefreshToken(mockReq);

      expect(result).toBeNull();
    });

    it('deve retornar null quando header x-refresh-token nao esta presente', () => {
      const mockReq = {
        cookies: {},
        get: jest.fn().mockReturnValue(null),
      } as any;

      const result = extractRefreshToken(mockReq);

      expect(result).toBeNull();
    });

    it('deve retornar token do header com trim aplicado', () => {
      const mockReq = {
        cookies: {},
        get: jest.fn().mockReturnValue('  header-refresh-token  '),
      } as any;

      const result = extractRefreshToken(mockReq);

      expect(result).toBe('header-refresh-token');
    });

    it('deve retornar null quando cookie refresh_token esta vazio', () => {
      const mockReq = {
        cookies: { refresh_token: '' },
        get: jest.fn().mockReturnValue(undefined),
      } as any;

      const result = extractRefreshToken(mockReq);

      // Empty string is falsy, so it falls through to header check
      expect(result).toBeNull();
    });
  });
});
