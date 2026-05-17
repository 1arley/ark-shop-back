import { RawBodyMiddleware } from '../middleware/raw-body.middleware';
import type { Request, Response, NextFunction } from 'express';
import { json } from 'express';

jest.mock('express', () => {
  const originalExpress = jest.requireActual('express');
  return {
    ...originalExpress,
    json: jest.fn(() => jest.fn((_req: any, _res: any, next: NextFunction) => next())),
  };
});

describe('RawBodyMiddleware', () => {
  let middleware: RawBodyMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = new RawBodyMiddleware();
    mockRequest = {
      rawBody: undefined,
    };
    mockResponse = {};
    mockNext = jest.fn();
  });

  describe('use', () => {
    it('deve passar adiante quando rawBody j\u00e1 existe e \u00e9 um Buffer v\u00e1lido', () => {
      mockRequest.rawBody = Buffer.from('existing raw body');

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    });

    it('deve re-parsar quando rawBody n\u00e3o existe', () => {
      mockRequest.rawBody = undefined;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(json).toHaveBeenCalled();
      const jsonOptions = (json as jest.Mock).mock.calls[0][0];
      expect(jsonOptions).toHaveProperty('verify');
      expect(typeof jsonOptions.verify).toBe('function');
    });

    it('deve re-parsar quando rawBody \u00e9 Buffer vazio', () => {
      mockRequest.rawBody = Buffer.from('');

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(json).toHaveBeenCalled();
    });

    it('deve definir rawBody no request atrav\u00e9s da fun\u00e7\u00e3o verify', () => {
      mockRequest.rawBody = undefined;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      const jsonOptions = (json as jest.Mock).mock.calls[0][0];
      const testBuffer = Buffer.from('test raw body content');
      const testReq: any = {};

      jsonOptions.verify(testReq, {}, testBuffer);

      expect(testReq.rawBody).toEqual(testBuffer);
    });

    it('deve chamar next atrav\u00e9s do json middleware quando re-parsando', () => {
      mockRequest.rawBody = undefined;

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      // O json mock chama next automaticamente
      expect(mockNext).toHaveBeenCalled();
    });

    it('deve lidar com rawBody que n\u00e3o \u00e9 Buffer', () => {
      (mockRequest as any).rawBody = 'not a buffer';

      middleware.use(mockRequest as Request, mockResponse as Response, mockNext);

      expect(json).toHaveBeenCalled();
    });
  });
});
