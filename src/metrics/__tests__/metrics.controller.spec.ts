import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from '../metrics.controller';
import { ConfigService } from '@nestjs/config';
import { register } from 'prom-client';

jest.mock('prom-client', () => ({
  register: {
    metrics: jest
      .fn()
      .mockResolvedValue('# HELP test_metric Test\n# TYPE test_metric counter\ntest_metric 0'),
  },
}));

describe('MetricsController', () => {
  let controller: MetricsController;
  let _configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    _configService = module.get<ConfigService>(ConfigService);
  });

  describe('getMetrics', () => {
    it('deve retornar m\u00e9tricas do Prometheus', async () => {
      const result = await controller.getMetrics();

      expect(result).toContain('# HELP');
      expect(result).toContain('# TYPE');
      expect(register.metrics).toHaveBeenCalled();
    });

    it('deve retornar string no formato Prometheus', async () => {
      const result = await controller.getMetrics();

      expect(typeof result).toBe('string');
    });
  });

  describe('getAdminMetrics', () => {
    it('deve retornar m\u00e9tricas do Prometheus no endpoint admin', async () => {
      const result = await controller.getAdminMetrics();

      expect(result).toContain('# HELP');
      expect(result).toContain('# TYPE');
    });

    it('deve retornar o mesmo formato que getMetrics', async () => {
      const publicMetrics = await controller.getMetrics();
      const adminMetrics = await controller.getAdminMetrics();

      expect(typeof adminMetrics).toBe(typeof publicMetrics);
    });
  });
});
