import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@/auth/auth.service';
import { AuthRegistrationService } from '@/auth/auth-registration.service';
import { AuthSessionService } from '@/auth/auth-session.service';
import { AuthPasswordService } from '@/auth/auth-password.service';
import { AuthTokenService } from '@/auth/auth-token.service';
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

/**
 * AuthService is now a thin facade that delegates to four focused sub-services.
 *
 * This test suite validates that delegation works correctly.
 * Detailed business-logic tests belong in the respective sub-service specs:
 *   - auth-registration.service.spec.ts
 *   - auth-session.service.spec.ts
 *   - auth-password.service.spec.ts
 *   - auth-token.service.spec.ts
 */

describe('AuthService (facade)', () => {
  let service: AuthService;
  let mockRegistration: jest.Mocked<AuthRegistrationService>;
  let mockSession: jest.Mocked<AuthSessionService>;
  let mockPassword: jest.Mocked<AuthPasswordService>;
  let mockToken: jest.Mocked<AuthTokenService>;

  const mockRegistrationService = {
    register: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
  };

  const mockSessionService = {
    login: jest.fn(),
    refreshTokens: jest.fn(),
    validateUser: jest.fn(),
    getVerificationStatus: jest.fn(),
  };

  const mockPasswordService = {
    forgotPassword: jest.fn(),
    forgotPasswordWithCode: jest.fn(),
    resetPassword: jest.fn(),
    resetPasswordWithCode: jest.fn(),
  };

  const mockTokenService = {
    revokeRefreshToken: jest.fn(),
    revokeAllUserRefreshTokens: jest.fn(),
    generateTokenPair: jest.fn(),
    createRefreshToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRegistrationService, useValue: mockRegistrationService },
        { provide: AuthSessionService, useValue: mockSessionService },
        { provide: AuthPasswordService, useValue: mockPasswordService },
        { provide: AuthTokenService, useValue: mockTokenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    mockRegistration = module.get(AuthRegistrationService);
    mockSession = module.get(AuthSessionService);
    mockPassword = module.get(AuthPasswordService);
    mockToken = module.get(AuthTokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register (delegates to AuthRegistrationService)', () => {
    const registerDto = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should delegate register and return result', async () => {
      const expected = {
        message: 'Registration successful.',
        user: { id: '1', name: 'Test User', email: 'test@example.com', role: 'USER' },
        emailVerificationRequired: true,
      };
      mockRegistrationService.register.mockResolvedValue(expected);

      const result = await service.register(registerDto);

      expect(result).toEqual(expected);
      expect(mockRegistration.register).toHaveBeenCalledWith(registerDto);
    });

    it('should propagate ConflictException from sub-service', async () => {
      mockRegistrationService.register.mockRejectedValue(
        new ConflictException('Email already registered.'),
      );

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login (delegates to AuthSessionService)', () => {
    const loginDto = { email: 'test@example.com', password: 'Password123!' };

    it('should delegate login and return result', async () => {
      const expected = {
        access_token: 'token',
        refresh_token: 'rtoken',
        user: { id: '1', email: 'test@example.com' },
        emailVerified: true,
      };
      mockSessionService.login.mockResolvedValue(expected);

      const result = await service.login(loginDto);

      expect(result).toEqual(expected);
      expect(mockSession.login).toHaveBeenCalledWith(loginDto);
    });

    it('should propagate UnauthorizedException', async () => {
      mockSessionService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials.'));

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens (delegates to AuthSessionService)', () => {
    it('should delegate refreshTokens', async () => {
      const expected = { access_token: 'new-at', refresh_token: 'new-rt' };
      mockSessionService.refreshTokens.mockResolvedValue(expected as any);

      const result = await service.refreshTokens('user-1', 'old-token');

      expect(result).toEqual(expected);
      expect(mockSession.refreshTokens).toHaveBeenCalledWith('user-1', 'old-token');
    });
  });

  describe('validateUser (delegates to AuthSessionService)', () => {
    it('should delegate validateUser', async () => {
      const expected = { id: '1', email: 'test@example.com', role: 'USER' };
      mockSessionService.validateUser.mockResolvedValue(expected as any);

      const result = await service.validateUser('1');

      expect(result).toEqual(expected);
      expect(mockSession.validateUser).toHaveBeenCalledWith('1');
    });
  });

  describe('getVerificationStatus (delegates to AuthSessionService)', () => {
    it('should delegate getVerificationStatus', async () => {
      mockSessionService.getVerificationStatus.mockResolvedValue({
        email: 'test@example.com',
        emailVerified: true,
      });

      const result = await service.getVerificationStatus('1');

      expect(result).toEqual({ email: 'test@example.com', emailVerified: true });
      expect(mockSession.getVerificationStatus).toHaveBeenCalledWith('1');
    });
  });

  describe('forgotPassword / resetPassword (delegates to AuthPasswordService)', () => {
    it('should delegate forgotPassword', async () => {
      mockPasswordService.forgotPassword.mockResolvedValue({
        message: 'Se o email existir, um link de redefinicao sera enviado.',
      });

      const result = await service.forgotPassword('test@example.com');

      expect(result).toEqual({
        message: 'Se o email existir, um link de redefinicao sera enviado.',
      });
      expect(mockPassword.forgotPassword).toHaveBeenCalledWith('test@example.com');
    });

    it('should delegate forgotPasswordWithCode', async () => {
      mockPasswordService.forgotPasswordWithCode.mockResolvedValue({
        message: 'Se o email existir, um codigo de redefinicao sera enviado.',
      });

      const result = await service.forgotPasswordWithCode('test@example.com');

      expect(result).toEqual({
        message: 'Se o email existir, um codigo de redefinicao sera enviado.',
      });
      expect(mockPassword.forgotPasswordWithCode).toHaveBeenCalledWith('test@example.com');
    });

    it('should delegate resetPassword', async () => {
      const dto = { token: 't', email: 'test@example.com', password: 'NewP@ss123' };
      mockPasswordService.resetPassword.mockResolvedValue({
        message: 'Senha redefinida com sucesso.',
      });

      const result = await service.resetPassword(dto);

      expect(result).toEqual({ message: 'Senha redefinida com sucesso.' });
      expect(mockPassword.resetPassword).toHaveBeenCalledWith(dto);
    });

    it('should delegate resetPasswordWithCode', async () => {
      const dto = { code: '123456', email: 'test@example.com', password: 'NewP@ss123' };
      mockPasswordService.resetPasswordWithCode.mockResolvedValue({
        message: 'Senha redefinida com sucesso.',
      });

      const result = await service.resetPasswordWithCode(dto);

      expect(result).toEqual({ message: 'Senha redefinida com sucesso.' });
      expect(mockPassword.resetPasswordWithCode).toHaveBeenCalledWith(dto);
    });

    it('should propagate BadRequestException from password sub-service', async () => {
      const dto = { token: 'bad', email: 'test@example.com', password: 'NewP@ss123' };
      mockPasswordService.resetPassword.mockRejectedValue(
        new BadRequestException('Token invalido ou expirado.'),
      );

      await expect(service.resetPassword(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyEmail / resend (delegates to AuthRegistrationService)', () => {
    it('should delegate verifyEmail', async () => {
      const dto = { email: 'test@example.com', code: '123456' };
      mockRegistrationService.verifyEmail.mockResolvedValue({
        message: 'Email verificado com sucesso.',
        emailVerified: true,
      });

      const result = await service.verifyEmail(dto);

      expect(result).toEqual({ message: 'Email verificado com sucesso.', emailVerified: true });
      expect(mockRegistration.verifyEmail).toHaveBeenCalledWith(dto);
    });

    it('should delegate resendVerificationEmail', async () => {
      mockRegistrationService.resendVerificationEmail.mockResolvedValue({
        message: 'Se o email existir, um novo codigo sera enviado.',
      });

      const result = await service.resendVerificationEmail('test@example.com');

      expect(result).toEqual({
        message: 'Se o email existir, um novo codigo sera enviado.',
      });
      expect(mockRegistration.resendVerificationEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('revokeRefreshToken (delegates to AuthTokenService)', () => {
    it('should delegate revokeRefreshToken', async () => {
      mockTokenService.revokeRefreshToken.mockResolvedValue(undefined);

      await service.revokeRefreshToken('some-token');

      expect(mockToken.revokeRefreshToken).toHaveBeenCalledWith('some-token');
    });

    it('should propagate NotFoundException', async () => {
      mockTokenService.revokeRefreshToken.mockRejectedValue(
        new NotFoundException('Refresh token não encontrado.'),
      );

      await expect(service.revokeRefreshToken('bad-token')).rejects.toThrow(NotFoundException);
    });
  });
});
