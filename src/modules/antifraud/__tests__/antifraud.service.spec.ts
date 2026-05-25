import { Test, TestingModule } from '@nestjs/testing';
import { AntifraudService } from '../antifraud.service';
import { AntifraudRepository } from '../antifraud.repository';
import { ConfigService } from '@nestjs/config';

describe('AntifraudService', () => {
  let service: AntifraudService;
  let repository: AntifraudRepository;

  const mockAntifraudRepository = {
    createFraudLog: jest.fn(),
    getFraudStats: jest.fn(),
    checkIPReputation: jest.fn(),
    checkDeviceBlacklist: jest.fn(),
    getUserOrderCount: jest.fn(),
    getUserPaymentSuccessRate: jest.fn(),
    getRecentFraudLogs: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AntifraudService,
        { provide: AntifraudRepository, useValue: mockAntifraudRepository },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AntifraudService>(AntifraudService);
    repository = module.get<AntifraudRepository>(AntifraudRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeRisk', () => {
    it('deve retornar risco BAIXO quando não há flags', async () => {
      mockAntifraudRepository.checkIPReputation.mockResolvedValue(true);
      mockAntifraudRepository.checkDeviceBlacklist.mockResolvedValue(false);
      mockAntifraudRepository.getUserOrderCount.mockResolvedValue(2);
      mockAntifraudRepository.getUserPaymentSuccessRate.mockResolvedValue(0.9);

      const result = await service.analyzeRisk({
        userId: 'user-1',
        orderId: 'order-1',
        ipAddress: '192.168.1.1',
        deviceFingerprint: 'device-123',
        amount: 100,
      });

      expect(result.riskScore).toBe(0);
      expect(result.riskLevel).toBe('LOW');
      expect(result.decision).toBe('APPROVED');
      expect(result.checks.ipReputation).toBe(true);
      expect(result.checks.velocityCheck).toBe(true);
      expect(result.checks.blacklistCheck).toBe(true);
      expect(result.checks.deviceCheck).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('deve retornar risco MÉDIO quando IP está na blacklist', async () => {
      mockAntifraudRepository.checkIPReputation.mockResolvedValue(false);
      mockAntifraudRepository.checkDeviceBlacklist.mockResolvedValue(false);
      mockAntifraudRepository.getUserOrderCount.mockResolvedValue(2);
      mockAntifraudRepository.getUserPaymentSuccessRate.mockResolvedValue(0.9);

      const result = await service.analyzeRisk({
        userId: 'user-1',
        orderId: 'order-1',
        ipAddress: '10.0.0.1',
        amount: 100,
      });

      expect(result.riskScore).toBe(40);
      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.decision).toBe('MANUAL_REVIEW');
      expect(result.reason).toBe('Blacklisted IP');
    });

    it('deve retornar risco MÉDIO quando alta velocidade de pedidos', async () => {
      mockAntifraudRepository.checkIPReputation.mockResolvedValue(true);
      mockAntifraudRepository.checkDeviceBlacklist.mockResolvedValue(false);
      mockAntifraudRepository.getUserOrderCount.mockResolvedValue(10);
      mockAntifraudRepository.getUserPaymentSuccessRate.mockResolvedValue(0.9);

      const result = await service.analyzeRisk({
        userId: 'user-1',
        orderId: 'order-1',
        amount: 100,
      });

      expect(result.riskScore).toBe(20);
      expect(result.riskLevel).toBe('LOW');
      expect(result.checks.velocityCheck).toBe(false);
    });

    it('deve retornar risco MÉDIO quando taxa de sucesso baixa', async () => {
      mockAntifraudRepository.checkIPReputation.mockResolvedValue(true);
      mockAntifraudRepository.checkDeviceBlacklist.mockResolvedValue(false);
      mockAntifraudRepository.getUserOrderCount.mockResolvedValue(2);
      mockAntifraudRepository.getUserPaymentSuccessRate.mockResolvedValue(0.3);

      const result = await service.analyzeRisk({
        userId: 'user-1',
        orderId: 'order-1',
        amount: 100,
      });

      expect(result.riskScore).toBe(15);
      expect(result.riskLevel).toBe('LOW');
      expect(result.reason).toBe('Low success rate');
    });

    it('deve retornar risco ALTO quando múltiplas flags', async () => {
      mockAntifraudRepository.checkIPReputation.mockResolvedValue(false);
      mockAntifraudRepository.checkDeviceBlacklist.mockResolvedValue(true);
      mockAntifraudRepository.getUserOrderCount.mockResolvedValue(10);
      mockAntifraudRepository.getUserPaymentSuccessRate.mockResolvedValue(0.3);

      const result = await service.analyzeRisk({
        userId: 'user-1',
        orderId: 'order-1',
        ipAddress: '10.0.0.1',
        deviceFingerprint: 'device-bad',
        amount: 100,
      });

      // 40 (IP) + 30 (device) + 20 (velocity) + 15 (success rate) = 105
      expect(result.riskScore).toBeGreaterThanOrEqual(70);
      expect(result.riskLevel).toBe('HIGH');
      expect(result.decision).toBe('REJECTED');
      expect(result.reason).toContain('Blacklisted IP');
      expect(result.reason).toContain('Blacklisted device');
    });

    it('deve retornar risco ALTO quando valor alto + outras flags', async () => {
      mockAntifraudRepository.checkIPReputation.mockResolvedValue(false);
      mockAntifraudRepository.checkDeviceBlacklist.mockResolvedValue(false);
      mockAntifraudRepository.getUserOrderCount.mockResolvedValue(2);
      mockAntifraudRepository.getUserPaymentSuccessRate.mockResolvedValue(0.9);

      const result = await service.analyzeRisk({
        userId: 'user-1',
        orderId: 'order-1',
        ipAddress: '10.0.0.1',
        amount: 5000,
      });

      // 40 (IP) + 10 (high amount) = 50
      expect(result.riskScore).toBe(50);
      expect(result.riskLevel).toBe('MEDIUM');
      expect(result.decision).toBe('MANUAL_REVIEW');
      expect(result.reason).toContain('Blacklisted IP');
      expect(result.reason).toContain('High amount');
    });

    it('deve criar log de fraude quando userId ou orderId são fornecidos', async () => {
      mockAntifraudRepository.checkIPReputation.mockResolvedValue(true);
      mockAntifraudRepository.checkDeviceBlacklist.mockResolvedValue(false);
      mockAntifraudRepository.getUserOrderCount.mockResolvedValue(2);
      mockAntifraudRepository.getUserPaymentSuccessRate.mockResolvedValue(0.9);
      mockAntifraudRepository.createFraudLog.mockResolvedValue({ id: 'log-1' });

      await service.analyzeRisk({
        userId: 'user-1',
        orderId: 'order-1',
        amount: 100,
      });

      expect(mockAntifraudRepository.createFraudLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          orderId: 'order-1',
          riskScore: 0,
          riskLevel: 'LOW',
          decision: 'APPROVED',
        }),
      );
    });

    it('não deve criar log de fraude quando userId e orderId não são fornecidos', async () => {
      mockAntifraudRepository.checkIPReputation.mockResolvedValue(true);
      mockAntifraudRepository.checkDeviceBlacklist.mockResolvedValue(false);

      await service.analyzeRisk({
        amount: 100,
      });

      expect(mockAntifraudRepository.createFraudLog).not.toHaveBeenCalled();
    });
  });

  describe('getFraudLogs', () => {
    it('deve retornar logs de fraude com limite personalizado', async () => {
      const logs = [
        { id: '1', riskScore: 50, riskLevel: 'MEDIUM' },
        { id: '2', riskScore: 80, riskLevel: 'HIGH' },
      ];

      mockAntifraudRepository.getRecentFraudLogs.mockResolvedValue(logs);

      const result = await service.getFraudLogs(50);

      expect(result).toEqual(logs);
      expect(repository.getRecentFraudLogs).toHaveBeenCalledWith(50);
    });

    it('deve usar limite padrão de 100', async () => {
      mockAntifraudRepository.getRecentFraudLogs.mockResolvedValue([]);

      await service.getFraudLogs();

      expect(repository.getRecentFraudLogs).toHaveBeenCalledWith(100);
    });
  });
});
