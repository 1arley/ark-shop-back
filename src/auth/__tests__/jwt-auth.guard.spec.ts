import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { IS_PUBLIC_KEY } from '@/auth/decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let _reflector: Reflector;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthGuard, { provide: Reflector, useValue: mockReflector }],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('deve permitir acesso quando rota e publica', () => {
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('deve chamar AuthGuard.canActivate quando rota nao e publica', () => {
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(false);

      const superCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate');
      superCanActivate.mockReturnValue(true);

      const _result = guard.canActivate(mockContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
      expect(superCanActivate).toHaveBeenCalledWith(mockContext);

      superCanActivate.mockRestore();
    });

    it('deve delegar ao AuthGuard quando isPublic e undefined', () => {
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      const superCanActivate = jest.spyOn(AuthGuard('jwt').prototype, 'canActivate');
      superCanActivate.mockReturnValue(true);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(superCanActivate).toHaveBeenCalledWith(mockContext);

      superCanActivate.mockRestore();
    });
  });
});
