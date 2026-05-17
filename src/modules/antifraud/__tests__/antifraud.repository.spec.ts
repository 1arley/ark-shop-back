import { Test, TestingModule } from '@nestjs/testing';
import { AntifraudRepository } from '../antifraud.repository';
import { PrismaService } from '@/prisma/prisma.service';

describe('AntifraudRepository', () => {
  let repository: AntifraudRepository;
  let prisma: PrismaService;

  const mockPrismaService = {
    fraudLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
    payment: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AntifraudRepository, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    repository = module.get<AntifraudRepository>(AntifraudRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createFraudLog', () => {
    it('deve criar log de fraude com todos os campos', async () => {
      const logData = {
        userId: 'user-1',
        orderId: 'order-1',
        riskScore: 75,
        riskLevel: 'HIGH',
        checks: {
          ipReputation: false,
          velocityCheck: true,
          blacklistCheck: true,
          deviceCheck: false,
        },
        ipAddress: '10.0.0.1',
        deviceFingerprint: 'device-bad',
        decision: 'REJECTED',
        reason: 'Blacklisted IP; High amount',
      };

      const createdLog = {
        id: 'log-1',
        ...logData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.fraudLog.create.mockResolvedValue(createdLog);

      const result = await repository.createFraudLog(logData);

      expect(result).toEqual(createdLog);
      expect(prisma.fraudLog.create).toHaveBeenCalledWith({
        data: logData,
      });
    });

    it('deve criar log de fraude com campos mínimos', async () => {
      const logData = {
        riskScore: 10,
        riskLevel: 'LOW',
        checks: {
          ipReputation: true,
          velocityCheck: true,
          blacklistCheck: true,
          deviceCheck: true,
        },
        decision: 'APPROVED',
      };

      const createdLog = {
        id: 'log-1',
        ...logData,
        userId: null,
        orderId: null,
        ipAddress: null,
        deviceFingerprint: null,
        reason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.fraudLog.create.mockResolvedValue(createdLog);

      const result = await repository.createFraudLog(logData);

      expect(result).toEqual(createdLog);
      expect(prisma.fraudLog.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          orderId: undefined,
          riskScore: 10,
          riskLevel: 'LOW',
          checks: {
            ipReputation: true,
            velocityCheck: true,
            blacklistCheck: true,
            deviceCheck: true,
          },
          ipAddress: undefined,
          deviceFingerprint: undefined,
          decision: 'APPROVED',
          reason: undefined,
        },
      });
    });
  });

  describe('getFraudStats', () => {
    it('deve retornar estatísticas com logs', async () => {
      const logs = [
        { riskScore: 50, riskLevel: 'MEDIUM', decision: 'MANUAL_REVIEW', reason: 'Test' },
        { riskScore: 80, riskLevel: 'HIGH', decision: 'REJECTED', reason: 'Fraud' },
      ];

      mockPrismaService.fraudLog.findMany.mockResolvedValue(logs);

      const result = await repository.getFraudStats('order-1');

      expect(result.fraudLogs).toEqual(logs);
      expect(result.averageRiskScore).toBe(65);
    });

    it('deve retornar média 0 quando não há logs', async () => {
      mockPrismaService.fraudLog.findMany.mockResolvedValue([]);

      const result = await repository.getFraudStats('order-999');

      expect(result.fraudLogs).toEqual([]);
      expect(result.averageRiskScore).toBe(0);
    });
  });

  describe('checkIPReputation', () => {
    it('deve sempre retornar true (placeholder)', async () => {
      const result = await repository.checkIPReputation('192.168.1.1');

      expect(result).toBe(true);
    });
  });

  describe('checkDeviceBlacklist', () => {
    it('deve sempre retornar false (placeholder)', async () => {
      const result = await repository.checkDeviceBlacklist('device-123');

      expect(result).toBe(false);
    });
  });

  describe('getUserOrderCount', () => {
    it('deve retornar contagem de pedidos', async () => {
      mockPrismaService.order.count.mockResolvedValue(5);

      const result = await repository.getUserOrderCount('user-1', 24);

      expect(result).toBe(5);
      expect(prisma.order.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          createdAt: {
            gte: expect.any(Date),
          },
        },
      });
    });
  });

  describe('getUserPaymentSuccessRate', () => {
    it('deve calcular taxa de sucesso com pagamentos', async () => {
      mockPrismaService.payment.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7); // approved

      const result = await repository.getUserPaymentSuccessRate('user-1');

      expect(result).toBe(0.7);
    });

    it('deve retornar 1 quando não há pagamentos', async () => {
      mockPrismaService.payment.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      const result = await repository.getUserPaymentSuccessRate('user-1');

      expect(result).toBe(1);
    });
  });

  describe('getRecentFraudLogs', () => {
    it('deve retornar logs recentes com limite personalizado', async () => {
      const logs = [
        { id: '1', riskScore: 50, riskLevel: 'MEDIUM' },
        { id: '2', riskScore: 80, riskLevel: 'HIGH' },
      ];

      mockPrismaService.fraudLog.findMany.mockResolvedValue(logs);

      const result = await repository.getRecentFraudLogs(50);

      expect(result).toEqual(logs);
      expect(prisma.fraudLog.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('deve usar limite padrão de 100', async () => {
      mockPrismaService.fraudLog.findMany.mockResolvedValue([]);

      await repository.getRecentFraudLogs();

      expect(prisma.fraudLog.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    });
  });
});
