import { LoggingInterceptor } from '../interceptors/logging.interceptor';
import type { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
    mockRequest = {
      method: 'GET',
      originalUrl: '/api/test',
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };
    mockResponse = {
      statusCode: 200,
      setHeader: jest.fn(),
    };
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    } as unknown as ExecutionContext;
    mockCallHandler = {
      handle: jest.fn(),
    } as unknown as CallHandler;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('intercept', () => {
    it('deve processar requisi\u00e7\u00e3o com sucesso', done => {
      mockCallHandler.handle = jest.fn().mockReturnValue(of({ data: 'test' }));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
          expect(mockRequest.correlationId).toBeDefined();
          done();
        },
      });
    });

    it('deve gerar UUID quando n\u00e3o h\u00e1 x-request-id header', done => {
      mockCallHandler.handle = jest.fn().mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          const correlationId = mockRequest.correlationId;
          expect(correlationId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
          );
          done();
        },
      });
    });

    it('deve usar x-request-id header quando fornecido', done => {
      mockRequest.headers = { 'x-request-id': 'custom-request-id-123' };
      mockCallHandler.handle = jest.fn().mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(mockRequest.correlationId).toBe('custom-request-id-123');
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'X-Request-Id',
            'custom-request-id-123',
          );
          done();
        },
      });
    });

    it('deve tratar erro na requisi\u00e7\u00e3o', done => {
      const error = new Error('Test error');
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: err => {
          expect(err).toBe(error);
          expect(mockRequest.correlationId).toBeDefined();
          done();
        },
      });
    });

    it('deve definir correlationId no request object', done => {
      mockCallHandler.handle = jest.fn().mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(mockRequest.correlationId).toBeDefined();
          expect(typeof mockRequest.correlationId).toBe('string');
          done();
        },
      });
    });

    it('deve definir header X-Request-Id na resposta', done => {
      mockCallHandler.handle = jest.fn().mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
          done();
        },
      });
    });

    it('deve usar ip do request quando dispon\u00edvel', done => {
      mockRequest.ip = '192.168.1.100';
      mockCallHandler.handle = jest.fn().mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          done();
        },
      });
    });

    it('deve usar socket.remoteAddress quando ip n\u00e3o est\u00e1 dispon\u00edvel', done => {
      mockRequest.ip = undefined;
      mockRequest.socket = { remoteAddress: '10.0.0.1' };
      mockCallHandler.handle = jest.fn().mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          done();
        },
      });
    });

    it('deve lidar com user-agent ausente', done => {
      mockRequest.headers = {};
      mockCallHandler.handle = jest.fn().mockReturnValue(of({}));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        complete: () => {
          done();
        },
      });
    });
  });
});
