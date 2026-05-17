import { HttpExceptionFilter } from '../filters/http-exception.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      method: 'GET',
      url: '/api/test',
      headers: {},
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as unknown as ArgumentsHost;
  });

  describe('catch', () => {
    it('deve tratar HttpException 400 (Bad Request)', () => {
      const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          path: '/api/test',
          correlationId: 'unknown',
        }),
      );
    });

    it('deve tratar HttpException 401 (Unauthorized)', () => {
      const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        }),
      );
    });

    it('deve tratar HttpException 403 (Forbidden)', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
        }),
      );
    });

    it('deve tratar HttpException 404 (Not Found)', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
        }),
      );
    });

    it('deve tratar HttpException 500 (Internal Server Error)', () => {
      const exception = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
        }),
      );
    });

    it('deve tratar erro n\u00e3o-HttpException como 500', () => {
      const exception = new Error('Unexpected error');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          message: 'Internal server error',
        }),
      );
    });

    it('deve usar correlationId do request quando dispon\u00edvel', () => {
      mockRequest.correlationId = 'corr-123';
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'corr-123',
        }),
      );
    });

    it('deve usar x-request-id header quando correlationId n\u00e3o est\u00e1 no request', () => {
      mockRequest.headers = { 'x-request-id': 'req-456' };
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'req-456',
        }),
      );
    });

    it('deve usar "unknown" quando n\u00e3o h\u00e1 correlationId nem x-request-id', () => {
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'unknown',
        }),
      );
    });

    it('deve tratar resposta de erro como objeto com message', () => {
      const exception = new HttpException(
        { message: 'Validation failed', error: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Validation failed',
        }),
      );
    });

    it('deve tratar resposta de erro como string', () => {
      const exception = new HttpException('Simple error message', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Simple error message',
        }),
      );
    });

    it('deve incluir timestamp na resposta', () => {
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      const jsonResponse = mockResponse.json.mock.calls[0][0];
      expect(jsonResponse.timestamp).toBeDefined();
      expect(new Date(jsonResponse.timestamp).toISOString()).toBe(jsonResponse.timestamp);
    });

    it('deve incluir path da requisi\u00e7\u00e3o na resposta', () => {
      mockRequest.url = '/api/users/123';
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/users/123',
        }),
      );
    });

    it('deve priorizar correlationId sobre x-request-id', () => {
      mockRequest.correlationId = 'corr-priority';
      mockRequest.headers = { 'x-request-id': 'req-header' };
      const exception = new HttpException('Error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: 'corr-priority',
        }),
      );
    });
  });
});
