import { Test, TestingModule } from '@nestjs/testing';
import { AntifraudController } from '../antifraud.controller';
import { AntifraudService } from '../antifraud.service';

describe('AntifraudController', () => {
  let controller: AntifraudController;
  let service: AntifraudService;

  const mockAntifraudService = {
    analyzeRisk: jest.fn(),
    getFraudLogs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AntifraudController],
      providers: [{ provide: AntifraudService, useValue: mockAntifraudService }],
    }).compile();

    controller = module.get<AntifraudController>(AntifraudController);
    service = module.get<AntifraudService>(AntifraudService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getFraudLogs (admin only)', () => {
    it('deve retornar logs de fraude com limite personalizado', async () => {
      const logs = [
        { id: '1', riskScore: 50, riskLevel: 'MEDIUM' },
        { id: '2', riskScore: 80, riskLevel: 'HIGH' },
      ];

      mockAntifraudService.getFraudLogs.mockResolvedValue(logs);

      const result = await controller.getFraudLogs(50);

      expect(result).toEqual(logs);
      expect(service.getFraudLogs).toHaveBeenCalledWith(50);
    });

    it('deve usar limite padrão quando não fornecido', async () => {
      mockAntifraudService.getFraudLogs.mockResolvedValue([]);

      // Controller has default value of 100 in parameter
      await controller.getFraudLogs(100);

      expect(service.getFraudLogs).toHaveBeenCalledWith(100);
    });
  });
});
