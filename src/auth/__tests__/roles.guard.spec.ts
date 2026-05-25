import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '@/auth/roles.guard';
import { ROLES_KEY } from '@/auth/roles.decorators';

describe('RolesGuard', () => {
  let guard: RolesGuard;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, { provide: Reflector, useValue: mockReflector }],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('deve permitir acesso quando nao ha roles requeridas', () => {
      const mockRequest = { user: { id: '1', role: 'USER' } };
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
        mockContext.getHandler(),
        mockContext.getClass(),
      ]);
    });

    it('deve permitir acesso quando nao ha roles requeridas (null)', () => {
      const mockRequest = { user: { id: '1', role: 'USER' } };
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(null);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('deve permitir acesso quando usuario tem role correspondente', () => {
      const mockRequest = { user: { id: '1', role: 'ADMIN' } };
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(['ADMIN', 'MODERATOR']);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('deve permitir acesso quando usuario tem uma das roles correspondentes', () => {
      const mockRequest = { user: { id: '1', role: 'MODERATOR' } };
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(['ADMIN', 'MODERATOR']);

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('deve lancar ForbiddenException quando usuario nao tem role correspondente', () => {
      const mockRequest = { user: { id: '1', role: 'USER' } };
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(['ADMIN', 'MODERATOR']);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Você não tem permissão para acessar este recurso.',
      );
    });

    it('deve lancar ForbiddenException quando nao ha usuario no request', () => {
      const mockRequest = { user: undefined };
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow('Usuário não autenticado.');
    });

    it('deve lancar ForbiddenException quando user e null', () => {
      const mockRequest = { user: null };
      const mockContext = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      mockReflector.getAllAndOverride.mockReturnValue(['ADMIN']);

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});
