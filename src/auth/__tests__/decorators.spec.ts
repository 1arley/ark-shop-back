import { SetMetadata } from '@nestjs/common';
import { Public, IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';
import {
  SkipEmailVerification,
  SKIP_EMAIL_VERIFICATION_KEY,
} from '@/auth/decorators/skip-email-verification.decorator';
import { Roles, ROLES_KEY } from '@/auth/roles.decorators';

// Mock SetMetadata to track calls
jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  SetMetadata: jest.fn(),
}));

describe('Decorators', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Public decorator', () => {
    it('deve chamar SetMetadata com IS_PUBLIC_KEY e valor true', () => {
      (SetMetadata as jest.Mock).mockReturnValue('mock-decorator');

      const result = Public();

      expect(SetMetadata).toHaveBeenCalledWith(IS_PUBLIC_KEY, true);
      expect(result).toBe('mock-decorator');
    });

    it('deve usar a chave correta IS_PUBLIC_KEY', () => {
      expect(IS_PUBLIC_KEY).toBe('isPublic');
    });
  });

  describe('SkipEmailVerification decorator', () => {
    it('deve chamar SetMetadata com SKIP_EMAIL_VERIFICATION_KEY e valor true', () => {
      (SetMetadata as jest.Mock).mockReturnValue('mock-decorator');

      const result = SkipEmailVerification();

      expect(SetMetadata).toHaveBeenCalledWith(SKIP_EMAIL_VERIFICATION_KEY, true);
      expect(result).toBe('mock-decorator');
    });

    it('deve usar a chave correta SKIP_EMAIL_VERIFICATION_KEY', () => {
      expect(SKIP_EMAIL_VERIFICATION_KEY).toBe('skipEmailVerification');
    });
  });

  describe('Roles decorator', () => {
    it('deve chamar SetMetadata com ROLES_KEY e array de roles', () => {
      (SetMetadata as jest.Mock).mockReturnValue('mock-decorator');

      const result = Roles('ADMIN', 'MODERATOR');

      expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, ['ADMIN', 'MODERATOR']);
      expect(result).toBe('mock-decorator');
    });

    it('deve chamar SetMetadata com role unica', () => {
      (SetMetadata as jest.Mock).mockReturnValue('mock-decorator');

      const result = Roles('ADMIN');

      expect(SetMetadata).toHaveBeenCalledWith(ROLES_KEY, ['ADMIN']);
      expect(result).toBe('mock-decorator');
    });

    it('deve usar a chave correta ROLES_KEY', () => {
      expect(ROLES_KEY).toBe('roles');
    });
  });
});
