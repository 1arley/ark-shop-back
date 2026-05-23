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
    it('deve chamar SetMetadata com chave isPublic e valor true', () => {
      (SetMetadata as jest.Mock).mockReturnValue('mock-decorator');

      const result = Public();

      expect(SetMetadata).toHaveBeenCalledWith('isPublic', true);
      expect(result).toBe('mock-decorator');
    });

    it('deve usar a chave correta IS_PUBLIC_KEY', () => {
      expect(IS_PUBLIC_KEY.KEY).toBe('isPublic');
    });
  });

  describe('SkipEmailVerification decorator', () => {
    it('deve chamar SetMetadata com chave skipEmailVerification e valor true', () => {
      (SetMetadata as jest.Mock).mockReturnValue('mock-decorator');

      const result = SkipEmailVerification();

      expect(SetMetadata).toHaveBeenCalledWith('skipEmailVerification', true);
      expect(result).toBe('mock-decorator');
    });

    it('deve usar a chave correta SKIP_EMAIL_VERIFICATION_KEY', () => {
      expect(SKIP_EMAIL_VERIFICATION_KEY.KEY).toBe('skipEmailVerification');
    });
  });

  describe('Roles decorator', () => {
    it('deve chamar SetMetadata com chave roles e array de roles', () => {
      (SetMetadata as jest.Mock).mockReturnValue('mock-decorator');

      const result = Roles('ADMIN', 'MODERATOR');

      expect(SetMetadata).toHaveBeenCalledWith('roles', ['ADMIN', 'MODERATOR']);
      expect(result).toBe('mock-decorator');
    });

    it('deve chamar SetMetadata com role unica', () => {
      (SetMetadata as jest.Mock).mockReturnValue('mock-decorator');

      const result = Roles('ADMIN');

      expect(SetMetadata).toHaveBeenCalledWith('roles', ['ADMIN']);
      expect(result).toBe('mock-decorator');
    });

    it('deve usar a chave correta ROLES_KEY', () => {
      expect(ROLES_KEY.KEY).toBe('roles');
    });
  });
});
