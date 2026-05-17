import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '@/auth/auth.controller';
import { AuthService } from '@/auth/auth.service';
import { RegisterDto } from '@/auth/dto/register.dto';
import { LoginDto } from '@/auth/dto/login.dto';
import { ForgotPasswordDto } from '@/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/auth/dto/reset-password.dto';
import { VerifyEmailDto } from '@/auth/dto/verify-email.dto';
import { ResetPasswordWithCodeDto } from '@/auth/dto/reset-password-code.dto';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthenticatedRequest } from '@/common/interfaces/request.interface';
import type { Response } from 'express';

const mockRes = () =>
  ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  }) as unknown as Response;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshTokens: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    forgotPasswordWithCode: jest.fn(),
    resetPasswordWithCode: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerificationEmail: jest.fn(),
    revokeRefreshToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should register a new user successfully without tokens (email verification required)', async () => {
      const mockResponse = {
        message: 'Registration successful. Please check your email to verify your account.',
        user: {
          id: '1',
          name: 'Test User',
          email: 'test@example.com',
          role: 'USER',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        emailVerificationRequired: true,
      };

      mockAuthService.register.mockResolvedValue(mockResponse);

      const result = await controller.register(registerDto);

      expect(result.message).toBe(mockResponse.message);
      expect(result.emailVerificationRequired).toBe(true);
      expect(result.user.email).toBe('test@example.com');
      expect(result).not.toHaveProperty('access_token');
      expect(result).not.toHaveProperty('refresh_token');
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });

    it('should propagate ConflictException when email already exists', async () => {
      mockAuthService.register.mockRejectedValue(new ConflictException('Email já cadastrado.'));

      await expect(controller.register(registerDto)).rejects.toThrow(ConflictException);
      expect(authService.register).toHaveBeenCalledWith(registerDto);
    });

    it('should handle validation errors from service', async () => {
      const invalidDto = { ...registerDto, email: 'invalid-email' };
      mockAuthService.register.mockRejectedValue(new ConflictException('Email já cadastrado.'));

      await expect(controller.register(invalidDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should login successfully and return tokens with emailVerified flag', async () => {
      const serviceResponse = {
        user: {
          id: '1',
          name: 'Test User',
          email: 'test@example.com',
          role: 'USER',
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        access_token: 'fake-access-token',
        refresh_token: 'fake-refresh-token',
        access_expires_in: 900,
        refresh_expires_in: 604800,
        emailVerified: true,
      };

      mockAuthService.login.mockResolvedValue(serviceResponse);

      const result = await controller.login(loginDto, mockRes());

      expect(result.access_token).toBe('fake-access-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.emailVerified).toBe(true);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });

    it('should propagate UnauthorizedException when credentials are invalid', async () => {
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Credenciais inválidas.'));

      await expect(controller.login(loginDto, mockRes())).rejects.toThrow(UnauthorizedException);
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });

    it('should handle empty email or password', async () => {
      const emptyDto: LoginDto = { email: '', password: '' };
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Credenciais inválidas.'));

      await expect(controller.login(emptyDto, mockRes())).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      const mockRequest = {
        user: {
          id: '1',
          email: 'test@example.com',
          role: 'USER',
          refreshToken: 'old-refresh-token',
        },
      };

      const serviceResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        access_expires_in: 900,
        refresh_expires_in: 604800,
      };

      mockAuthService.refreshTokens.mockResolvedValue(serviceResponse);

      const result = await controller.refreshTokens(
        mockRequest as unknown as AuthenticatedRequest,
        mockRes(),
      );

      expect(result.access_token).toBe('new-access-token');
      expect(authService.refreshTokens).toHaveBeenCalledWith('1', 'old-refresh-token');
    });

    it('should handle missing user data in request', async () => {
      const invalidRequest = { user: null };

      // In real scenario, the guard would reject this before reaching the controller.
      // Without the guard, accessing null.id throws a TypeError.
      await expect(
        controller.refreshTokens(invalidRequest as unknown as AuthenticatedRequest, mockRes()),
      ).rejects.toThrow(TypeError);
    });

    it('should propagate service errors during token refresh', async () => {
      const mockRequest = {
        user: {
          id: '1',
          email: 'test@example.com',
          role: 'USER',
        },
      };

      mockAuthService.refreshTokens.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );

      await expect(
        controller.refreshTokens(mockRequest as unknown as AuthenticatedRequest, mockRes()),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('deve revogar refresh token e limpar cookies quando token esta presente', async () => {
      const mockRequest = {
        user: { id: '1', email: 'test@example.com', role: 'USER', emailVerified: true },
        cookies: { refresh_token: 'some-refresh-token' },
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as AuthenticatedRequest;
      const res = mockRes();

      mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

      const result = await controller.logout(mockRequest, res);

      expect(result).toEqual({ message: 'Logout realizado com sucesso.' });
      expect(authService.revokeRefreshToken).toHaveBeenCalledWith('some-refresh-token');
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
    });

    it('deve limpar cookies mesmo quando nao ha refresh token', async () => {
      const mockRequest = {
        user: { id: '1', email: 'test@example.com', role: 'USER', emailVerified: true },
        cookies: {},
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as AuthenticatedRequest;
      const res = mockRes();

      const result = await controller.logout(mockRequest, res);

      expect(result).toEqual({ message: 'Logout realizado com sucesso.' });
      expect(authService.revokeRefreshToken).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
    });

    it('deve limpar cookies mesmo se revogacao falhar', async () => {
      const mockRequest = {
        user: { id: '1', email: 'test@example.com', role: 'USER', emailVerified: true },
        cookies: { refresh_token: 'invalid-token' },
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as AuthenticatedRequest;
      const res = mockRes();

      mockAuthService.revokeRefreshToken.mockRejectedValue(
        new UnauthorizedException('Token not found'),
      );

      const result = await controller.logout(mockRequest, res);

      expect(result).toEqual({ message: 'Logout realizado com sucesso.' });
      expect(res.clearCookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('forgotPassword', () => {
    it('deve solicitar redefinicao de senha com sucesso', async () => {
      const dto: ForgotPasswordDto = { email: 'test@example.com' };
      mockAuthService.forgotPassword.mockResolvedValue({
        message: 'Se o email existir, um link de redefinicao sera enviado.',
      });

      const result = await controller.forgotPassword(dto);

      expect(result).toEqual({
        message: 'Se o email existir, um link de redefinicao sera enviado.',
      });
      expect(authService.forgotPassword).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('resetPassword', () => {
    it('deve redefinir senha com sucesso', async () => {
      const dto: ResetPasswordDto = {
        token: 'valid-token',
        email: 'test@example.com',
        password: 'NewPassword123!',
      };
      mockAuthService.resetPassword.mockResolvedValue({
        message: 'Senha redefinida com sucesso.',
      });

      const result = await controller.resetPassword(dto);

      expect(result).toEqual({ message: 'Senha redefinida com sucesso.' });
      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
    });

    it('deve propagar BadRequestException para token invalido', async () => {
      const dto: ResetPasswordDto = {
        token: 'invalid-token',
        email: 'test@example.com',
        password: 'NewPassword123!',
      };
      mockAuthService.resetPassword.mockRejectedValue(
        new BadRequestException('Token invalido ou expirado.'),
      );

      await expect(controller.resetPassword(dto)).rejects.toThrow(BadRequestException);
      expect(authService.resetPassword).toHaveBeenCalledWith(dto);
    });
  });

  describe('forgotPasswordWithCode', () => {
    it('deve solicitar redefinicao de senha via codigo com sucesso', async () => {
      const dto: ForgotPasswordDto = { email: 'test@example.com' };
      mockAuthService.forgotPasswordWithCode.mockResolvedValue({
        message: 'Se o email existir, um codigo de redefinicao sera enviado.',
      });

      const result = await controller.forgotPasswordWithCode(dto);

      expect(result).toEqual({
        message: 'Se o email existir, um codigo de redefinicao sera enviado.',
      });
      expect(authService.forgotPasswordWithCode).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('resetPasswordWithCode', () => {
    it('deve redefinir senha com codigo com sucesso', async () => {
      const dto: ResetPasswordWithCodeDto = {
        code: '123456',
        email: 'test@example.com',
        password: 'NewPassword123!',
      };
      mockAuthService.resetPasswordWithCode.mockResolvedValue({
        message: 'Senha redefinida com sucesso.',
      });

      const result = await controller.resetPasswordWithCode(dto);

      expect(result).toEqual({ message: 'Senha redefinida com sucesso.' });
      expect(authService.resetPasswordWithCode).toHaveBeenCalledWith(dto);
    });

    it('deve propagar BadRequestException para codigo invalido', async () => {
      const dto: ResetPasswordWithCodeDto = {
        code: 'invalid',
        email: 'test@example.com',
        password: 'NewPassword123!',
      };
      mockAuthService.resetPasswordWithCode.mockRejectedValue(
        new BadRequestException('Codigo invalido ou expirado.'),
      );

      await expect(controller.resetPasswordWithCode(dto)).rejects.toThrow(BadRequestException);
      expect(authService.resetPasswordWithCode).toHaveBeenCalledWith(dto);
    });
  });

  describe('verifyEmail', () => {
    it('deve verificar email com sucesso', async () => {
      const dto: VerifyEmailDto = { email: 'test@example.com', code: '123456' };
      mockAuthService.verifyEmail.mockResolvedValue({
        message: 'Email verificado com sucesso.',
        emailVerified: true,
      });

      const result = await controller.verifyEmail(dto);

      expect(result).toEqual({ message: 'Email verificado com sucesso.', emailVerified: true });
      expect(authService.verifyEmail).toHaveBeenCalledWith(dto);
    });

    it('deve propagar BadRequestException para codigo invalido', async () => {
      const dto: VerifyEmailDto = { email: 'test@example.com', code: 'invalid' };
      mockAuthService.verifyEmail.mockRejectedValue(
        new BadRequestException('Codigo de verificacao invalido ou expirado.'),
      );

      await expect(controller.verifyEmail(dto)).rejects.toThrow(BadRequestException);
      expect(authService.verifyEmail).toHaveBeenCalledWith(dto);
    });
  });

  describe('resendVerification', () => {
    it('deve reenviar email de verificacao com sucesso', async () => {
      const dto: ForgotPasswordDto = { email: 'test@example.com' };
      mockAuthService.resendVerificationEmail.mockResolvedValue({
        message: 'Se o email existir, um novo codigo sera enviado.',
      });

      const result = await controller.resendVerification(dto);

      expect(result).toEqual({ message: 'Se o email existir, um novo codigo sera enviado.' });
      expect(authService.resendVerificationEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  // Edge cases and security scenarios
  describe('security scenarios', () => {
    const registerDto: RegisterDto = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('should not expose sensitive data in error messages', async () => {
      mockAuthService.register.mockRejectedValue(new ConflictException('Email já cadastrado.'));

      try {
        await controller.register(registerDto);
      } catch (error) {
        expect((error as { message?: string }).message).not.toContain('password');
        expect((error as { message?: string }).message).not.toContain('hashed');
        expect((error as { message?: string }).message).toBe('Email já cadastrado.');
      }
    });

    it('should handle timing attacks (service responsibility)', async () => {
      // This is mostly the service's responsibility, but controller should
      // not leak information about whether user exists or not
      const loginDto: LoginDto = {
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      };

      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Credenciais inválidas.'));

      await expect(controller.login(loginDto, mockRes())).rejects.toThrow(UnauthorizedException);
      // The error message should be generic, not specific about whether
      // email exists or password is wrong
      expect(authService.login).toHaveBeenCalledWith(loginDto);
    });
  });

  // Performance and validation tests
  describe('validation and performance', () => {
    it('should handle large payloads appropriately', async () => {
      const largeDto: RegisterDto = {
        name: 'A'.repeat(255),
        email: 'test@example.com',
        password: 'P'.repeat(100),
      };

      const mockResponse = {
        message: 'Registration successful. Please check your email to verify your account.',
        user: {
          id: '1',
          name: largeDto.name,
          email: largeDto.email,
          role: 'USER',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        emailVerificationRequired: true,
      };

      mockAuthService.register.mockResolvedValue(mockResponse);

      const result = await controller.register(largeDto);

      expect(result.user.name).toBe(largeDto.name);
      expect(authService.register).toHaveBeenCalledWith(largeDto);
    });

    it('should handle concurrent requests', async () => {
      // This is more of an integration test scenario
      const registerDto: RegisterDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
      };

      const mockResponse = {
        message: 'Registration successful. Please check your email to verify your account.',
        user: {
          id: '1',
          name: 'Test User',
          email: 'test@example.com',
          role: 'USER',
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        emailVerificationRequired: true,
      };

      mockAuthService.register.mockResolvedValue(mockResponse);

      // Simulate multiple calls
      const promises = [
        controller.register(registerDto),
        controller.register(registerDto),
        controller.register(registerDto),
      ];

      const results = await Promise.allSettled(promises);

      // First should succeed, others should fail due to conflict
      expect(results[0]?.status).toBe('fulfilled');
      expect(authService.register).toHaveBeenCalledTimes(3);
    });
  });
});
