import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmailVerifiedGuard } from '@/auth/email-verified.guard';
import { SKIP_EMAIL_VERIFICATION_KEY } from '@/auth/decorators/skip-email-verification.decorator';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';

describe('EmailVerifiedGuard', () => {
  let guard: EmailVerifiedGuard;
  let _reflector: Reflector;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailVerifiedGuard, { provide: Reflector, useValue: mockReflector }],
    }).compile();

    guard = module.get<EmailVerifiedGuard>(EmailVerifiedGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('deve permitir acesso quando rota e publica', () => {
      const mockRequest = {} as any;
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride
        .mockReturnValueOnce(true) // IS_PUBLIC_KEY = true
        .mockReturnValueOnce(false); // SKIP_EMAIL_VERIFICATION_KEY = false

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenNthCalledWith(1, IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('deve permitir acesso quando decorator skip-email-verification esta presente', () => {
      const mockRequest = {} as any;
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY = false
        .mockReturnValueOnce(true); // SKIP_EMAIL_VERIFICATION_KEY = true

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenNthCalledWith(
        2,
        SKIP_EMAIL_VERIFICATION_KEY,
        [mockContext.getHandler(), mockContext.getClass()],
      );
    });

    it('deve permitir acesso quando usuario tem email verificado', () => {
      const mockRequest = {
        user: {
          id: '1',
          email: 'test@example.com',
          emailVerified: true,
          role: 'USER',
        },
      };
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY = false
        .mockReturnValueOnce(false); // SKIP_EMAIL_VERIFICATION_KEY = false

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('deve lancar ForbiddenException quando usuario tem email nao verificado', () => {
      const mockRequest = {
        user: {
          id: '1',
          email: 'test@example.com',
          emailVerified: false,
          role: 'USER',
        },
      };
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY = false
        .mockReturnValueOnce(false); // SKIP_EMAIL_VERIFICATION_KEY = false

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Email not verified. Please verify your email before accessing this resource.',
      );
    });

    it('deve permitir acesso quando nao ha usuario no request (delega para JwtAuthGuard)', () => {
      const mockRequest = { user: undefined };
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY = false
        .mockReturnValueOnce(false); // SKIP_EMAIL_VERIFICATION_KEY = false

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('deve permitir acesso quando user e null no request', () => {
      const mockRequest = { user: null };
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY = false
        .mockReturnValueOnce(false); // SKIP_EMAIL_VERIFICATION_KEY = false

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });
  });
});
