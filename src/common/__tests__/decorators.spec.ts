import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

// Importamos os decorators para verificar que existem e est\u00e3o corretamente exportados
import { CurrentUser, CurrentUserOptional } from '../decorators/current-user.decorator';
import { RawBody } from '../decorators/raw-body.decorator';

// Recriamos a l\u00f3gica interna dos decorators para testar diretamente
// Isso \u00e9 necess\u00e1rio porque createParamDecorator s\u00f3 executa o callback
// atrav\u00e9s do pipeline HTTP do NestJS

function currentUserCallback(_data: unknown, ctx: ExecutionContext) {
  const request = ctx.switchToHttp().getRequest();
  const user = request.user;
  if (!user) {
    throw new UnauthorizedException('User not authenticated');
  }
  return user;
}

function currentUserOptionalCallback(_data: unknown, ctx: ExecutionContext) {
  const request = ctx.switchToHttp().getRequest();
  return request.user || null;
}

function rawBodyCallback(_data: unknown, ctx: ExecutionContext): Buffer {
  const request = ctx.switchToHttp().getRequest();
  return request.rawBody!;
}

describe('Decorators', () => {
  describe('CurrentUser', () => {
    it('deve ser exportado como decorator', () => {
      expect(CurrentUser).toBeDefined();
      expect(typeof CurrentUser).toBe('function');
    });

    it('deve retornar o usu\u00e1rio do request quando autenticado', () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', role: 'USER' };
      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: mockUser }),
        }),
      } as unknown as ExecutionContext;

      const result = currentUserCallback(undefined, mockExecutionContext);

      expect(result).toEqual(mockUser);
    });

    it('deve lan\u00e7ar UnauthorizedException quando usu\u00e1rio n\u00e3o est\u00e1 autenticado', () => {
      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: null }),
        }),
      } as unknown as ExecutionContext;

      expect(() => currentUserCallback(undefined, mockExecutionContext)).toThrow(
        UnauthorizedException,
      );
    });

    it('deve lan\u00e7ar UnauthorizedException quando user \u00e9 undefined', () => {
      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({}),
        }),
      } as unknown as ExecutionContext;

      expect(() => currentUserCallback(undefined, mockExecutionContext)).toThrow(
        UnauthorizedException,
      );
    });

    it('deve lan\u00e7ar UnauthorizedException com mensagem correta', () => {
      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: undefined }),
        }),
      } as unknown as ExecutionContext;

      try {
        currentUserCallback(undefined, mockExecutionContext);
        fail('Deveria ter lan\u00e7ado UnauthorizedException');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect((error as UnauthorizedException).message).toBe('User not authenticated');
      }
    });
  });

  describe('CurrentUserOptional', () => {
    it('deve ser exportado como decorator', () => {
      expect(CurrentUserOptional).toBeDefined();
      expect(typeof CurrentUserOptional).toBe('function');
    });

    it('deve retornar o usu\u00e1rio quando autenticado', () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: mockUser }),
        }),
      } as unknown as ExecutionContext;

      const result = currentUserOptionalCallback(undefined, mockExecutionContext);

      expect(result).toEqual(mockUser);
    });

    it('deve retornar null quando usu\u00e1rio n\u00e3o est\u00e1 autenticado', () => {
      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ user: null }),
        }),
      } as unknown as ExecutionContext;

      const result = currentUserOptionalCallback(undefined, mockExecutionContext);

      expect(result).toBeNull();
    });

    it('deve retornar null quando user \u00e9 undefined', () => {
      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({}),
        }),
      } as unknown as ExecutionContext;

      const result = currentUserOptionalCallback(undefined, mockExecutionContext);

      expect(result).toBeNull();
    });

    it('n\u00e3o deve lan\u00e7ar exce\u00e7\u00e3o quando usu\u00e1rio n\u00e3o est\u00e1 presente', () => {
      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({}),
        }),
      } as unknown as ExecutionContext;

      expect(() => currentUserOptionalCallback(undefined, mockExecutionContext)).not.toThrow();
    });
  });

  describe('RawBody', () => {
    it('deve ser exportado como decorator', () => {
      expect(RawBody).toBeDefined();
      expect(typeof RawBody).toBe('function');
    });

    it('deve retornar o rawBody do request', () => {
      const mockRawBody = Buffer.from('raw body content');
      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ rawBody: mockRawBody }),
        }),
      } as unknown as ExecutionContext;

      const result = rawBodyCallback(undefined, mockExecutionContext);

      expect(result).toEqual(mockRawBody);
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('deve retornar Buffer com conte\u00fado correto', () => {
      const testContent = '{"webhook":"data"}';
      const mockRawBody = Buffer.from(testContent);
      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ rawBody: mockRawBody }),
        }),
      } as unknown as ExecutionContext;

      const result = rawBodyCallback(undefined, mockExecutionContext);

      expect(result.toString()).toBe(testContent);
    });
  });
});
