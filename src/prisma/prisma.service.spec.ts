import { PrismaService } from '@/prisma/prisma.service';

describe('PrismaService', () => {
  it('should have onModuleInit method defined on prototype', () => {
    expect(typeof PrismaService.prototype.onModuleInit).toBe('function');
  });

  it('should have onModuleDestroy method defined on prototype', () => {
    expect(typeof PrismaService.prototype.onModuleDestroy).toBe('function');
  });

  it('should implement OnModuleInit and OnModuleDestroy interfaces', () => {
    // Verify the class has the required lifecycle hooks on its prototype
    const protoMethods = Object.getOwnPropertyNames(PrismaService.prototype);
    expect(protoMethods).toContain('onModuleInit');
    expect(protoMethods).toContain('onModuleDestroy');
  });

  describe('onModuleInit', () => {
    it('deve chamar $connect ao inicializar o m\u00f3dulo', async () => {
      const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      };

      const mockPrismaService = {
        $connect: jest.fn().mockResolvedValue(undefined),
        $disconnect: jest.fn().mockResolvedValue(undefined),
        logger: mockLogger,
      };

      await PrismaService.prototype.onModuleInit.call(mockPrismaService);

      expect(mockPrismaService.$connect).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('Database connected successfully');
    });

    it('deve lan\u00e7ar erro quando $connect falha', async () => {
      const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      };

      const mockError = new Error('Connection refused');
      const mockPrismaService = {
        $connect: jest.fn().mockRejectedValue(mockError),
        $disconnect: jest.fn().mockResolvedValue(undefined),
        logger: mockLogger,
      };

      await expect(PrismaService.prototype.onModuleInit.call(mockPrismaService)).rejects.toThrow(
        'Connection refused',
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Database connection failed'),
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('deve chamar $disconnect ao destruir o m\u00f3dulo', async () => {
      const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      };

      const mockPgPool = { end: jest.fn().mockResolvedValue(undefined) };
      const mockPrismaService = {
        $connect: jest.fn().mockResolvedValue(undefined),
        $disconnect: jest.fn().mockResolvedValue(undefined),
        pgPool: mockPgPool,
        logger: mockLogger,
      };

      await PrismaService.prototype.onModuleDestroy.call(mockPrismaService);

      expect(mockPrismaService.$disconnect).toHaveBeenCalled();
      expect(mockPgPool.end).toHaveBeenCalled();
    });

    it('n\u00e3o deve lan\u00e7ar erro quando $disconnect falha', async () => {
      const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
      };

      const mockPrismaService = {
        $connect: jest.fn().mockResolvedValue(undefined),
        $disconnect: jest.fn().mockRejectedValue(new Error('Disconnect warning')),
        logger: mockLogger,
      };

      // onModuleDestroy captura o erro internamente e n\u00e3o lan\u00e7a
      await expect(
        PrismaService.prototype.onModuleDestroy.call(mockPrismaService),
      ).resolves.toBeUndefined();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Database disconnect warning'),
      );
    });
  });
});
