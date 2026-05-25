import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from '../health.controller';
import { HealthCheckService, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '@/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

jest.mock('axios');

describe('HealthController', () => {
  let controller: HealthController;

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
      if (key === 'HEALTH_MEMORY_THRESHOLD_MB') return defaultValue || '500';
      if (key === 'DATABASE_PROVIDER') return defaultValue || 'postgresql';
      if (key === 'STORAGE_DRIVER') return defaultValue || 'local';
      if (key === 'S3_ENDPOINT') return defaultValue;
      if (key === 'RESEND_API_KEY') return defaultValue;
      if (key === 'EMAIL_FROM') return defaultValue;
      if (key === 'ASAAS_API_KEY') return defaultValue;
      if (key === 'ASAAS_SANDBOX') return defaultValue || 'true';
      return defaultValue;
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('check (health check b\u00e1sico)', () => {
    it('deve retornar health check b\u00e1sico com todos os servi\u00e7os saud\u00e1veis', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ count: 10 }]);

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.check()) as any;

      expect(result).toHaveProperty('database');
      expect(result.database).toHaveProperty('status', 'up');
      expect(result).toHaveProperty('memory');
      expect(result).toHaveProperty('uptime');
    });

    it('deve retornar database down quando falha na conex\u00e3o', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.check()) as any;

      expect(result.database).toHaveProperty('status', 'down');
      expect(result.database).toHaveProperty('message', 'Cannot connect to database');
    });

    it('deve retornar memory down quando uso excede o threshold', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ count: 10 }]);
      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'HEALTH_MEMORY_THRESHOLD_MB') return '0.0001'; // threshold muito baixo
        if (key === 'DATABASE_PROVIDER') return defaultValue || 'postgresql';
        return defaultValue;
      });

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.check()) as any;

      expect(result.memory).toHaveProperty('status', 'down');
      expect(result.memory.message).toContain('exceeds threshold');
    });

    it('deve retornar memory up quando uso est\u00e1 dentro do threshold', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ count: 10 }]);
      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'HEALTH_MEMORY_THRESHOLD_MB') return '999999'; // threshold muito alto
        if (key === 'DATABASE_PROVIDER') return defaultValue || 'postgresql';
        return defaultValue;
      });

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.check()) as any;

      expect(result.memory).toHaveProperty('status', 'up');
      expect(result.memory).toHaveProperty('heapUsedMB');
      expect(result.memory).toHaveProperty('thresholdMB');
    });

    it('deve retornar uptime com segundos e timestamp', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ count: 10 }]);

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.check()) as any;

      expect(result.uptime).toHaveProperty('status', 'up');
      expect(result.uptime).toHaveProperty('seconds');
      expect(result.uptime).toHaveProperty('timestamp');
    });
  });

  describe('ready (readiness probe)', () => {
    it('deve retornar database up quando banco est\u00e1 acess\u00edvel', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ count: 10 }]);

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.ready()) as any;

      expect(result.database).toHaveProperty('status', 'up');
    });

    it('deve retornar database down quando banco n\u00e3o est\u00e1 acess\u00edvel', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection refused'));

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.ready()) as any;

      expect(result.database).toHaveProperty('status', 'down');
      expect(result.database).toHaveProperty('message', 'Database unreachable');
    });
  });

  describe('detailed (health check detalhado - admin)', () => {
    it('deve retornar todos os servi\u00e7os saud\u00e1veis', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ count: 10 }]) // database ping
        .mockResolvedValueOnce([{ count: 15 }]); // migrations count

      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'HEALTH_MEMORY_THRESHOLD_MB') return '999999';
        if (key === 'DATABASE_PROVIDER') return 'postgresql';
        if (key === 'STORAGE_DRIVER') return 'local';
        if (key === 'S3_ENDPOINT') return defaultValue;
        if (key === 'RESEND_API_KEY') return 're_valid_api_key_123';
        if (key === 'EMAIL_FROM') return 'noreply@example.com';
        if (key === 'ASAAS_API_KEY') return 'asaas_test_key';
        if (key === 'ASAAS_SANDBOX') return 'true';
        return defaultValue;
      });

      (axios.get as jest.Mock).mockResolvedValue({ status: 200, data: {} });

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.detailed()) as any;

      expect(result.database).toHaveProperty('status', 'up');
      expect(result.database).toHaveProperty('provider', 'postgresql');
      expect(result.database).toHaveProperty('migrationsApplied', 15);
      expect(result.storage).toHaveProperty('status', 'up');
      expect(result.storage).toHaveProperty('driver', 'local');
      expect(result.email).toHaveProperty('status', 'up');
      expect(result.email).toHaveProperty('provider', 'resend');
      expect(result.payment).toHaveProperty('status', 'up');
      expect(result.payment).toHaveProperty('provider', 'asaas');
      expect(result.payment).toHaveProperty('environment', 'sandbox');
    });

    it('deve retornar database unhealthy', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('Database connection failed'));

      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'HEALTH_MEMORY_THRESHOLD_MB') return '999999';
        if (key === 'DATABASE_PROVIDER') return 'postgresql';
        if (key === 'STORAGE_DRIVER') return 'local';
        if (key === 'S3_ENDPOINT') return defaultValue;
        if (key === 'RESEND_API_KEY') return 're_valid_api_key_123';
        if (key === 'EMAIL_FROM') return 'noreply@example.com';
        if (key === 'ASAAS_API_KEY') return 'asaas_test_key';
        if (key === 'ASAAS_SANDBOX') return 'true';
        return defaultValue;
      });

      (axios.get as jest.Mock).mockResolvedValue({ status: 200, data: {} });

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.detailed()) as any;

      expect(result.database).toHaveProperty('status', 'down');
      expect(result.database.message).toBe('Database connection failed');
    });

    it('deve retornar storage unhealthy', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([{ count: 15 }]);

      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'HEALTH_MEMORY_THRESHOLD_MB') return '999999';
        if (key === 'DATABASE_PROVIDER') return 'postgresql';
        if (key === 'STORAGE_DRIVER') return 's3';
        if (key === 'S3_ENDPOINT') return 'http://localhost:9000/storage/v1/s3';
        if (key === 'RESEND_API_KEY') return 're_valid_api_key_123';
        if (key === 'EMAIL_FROM') return 'noreply@example.com';
        if (key === 'ASAAS_API_KEY') return 'asaas_test_key';
        if (key === 'ASAAS_SANDBOX') return 'true';
        return defaultValue;
      });

      (axios.get as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.detailed()) as any;

      expect(result.storage).toHaveProperty('status', 'down');
    });

    it('deve retornar email unhealthy quando RESEND_API_KEY n\u00e3o configurado', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([{ count: 15 }]);

      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'HEALTH_MEMORY_THRESHOLD_MB') return '999999';
        if (key === 'DATABASE_PROVIDER') return 'postgresql';
        if (key === 'STORAGE_DRIVER') return 'local';
        if (key === 'S3_ENDPOINT') return defaultValue;
        if (key === 'RESEND_API_KEY') return undefined;
        if (key === 'EMAIL_FROM') return 'noreply@example.com';
        if (key === 'ASAAS_API_KEY') return 'asaas_test_key';
        if (key === 'ASAAS_SANDBOX') return 'true';
        return defaultValue;
      });

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.detailed()) as any;

      expect(result.email).toHaveProperty('status', 'down');
      expect(result.email.message).toContain('RESEND_API_KEY not configured');
    });

    it('deve retornar email unhealthy quando RESEND_API_KEY \u00e9 inv\u00e1lido', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([{ count: 15 }]);

      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'HEALTH_MEMORY_THRESHOLD_MB') return '999999';
        if (key === 'DATABASE_PROVIDER') return 'postgresql';
        if (key === 'STORAGE_DRIVER') return 'local';
        if (key === 'S3_ENDPOINT') return defaultValue;
        if (key === 'RESEND_API_KEY') return 'invalid_prefix_key';
        if (key === 'EMAIL_FROM') return 'noreply@example.com';
        if (key === 'ASAAS_API_KEY') return 'asaas_test_key';
        if (key === 'ASAAS_SANDBOX') return 'true';
        return defaultValue;
      });

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.detailed()) as any;

      expect(result.email).toHaveProperty('status', 'down');
      expect(result.email.message).toContain('RESEND_API_KEY not configured or invalid');
    });

    it('deve retornar payment unhealthy quando ASAAS_API_KEY n\u00e3o configurado', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([{ count: 15 }]);

      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'HEALTH_MEMORY_THRESHOLD_MB') return '999999';
        if (key === 'DATABASE_PROVIDER') return 'postgresql';
        if (key === 'STORAGE_DRIVER') return 'local';
        if (key === 'S3_ENDPOINT') return defaultValue;
        if (key === 'RESEND_API_KEY') return 're_valid_api_key_123';
        if (key === 'EMAIL_FROM') return 'noreply@example.com';
        if (key === 'ASAAS_API_KEY') return undefined;
        if (key === 'ASAAS_SANDBOX') return 'true';
        return defaultValue;
      });

      (axios.get as jest.Mock).mockResolvedValue({ status: 200, data: {} });

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.detailed()) as any;

      expect(result.payment).toHaveProperty('status', 'down');
      expect(result.payment.message).toContain('ASAAS_API_KEY not configured');
    });

    it('deve verificar storage S3 com endpoint quando driver \u00e9 s3', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([{ count: 15 }]);

      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'HEALTH_MEMORY_THRESHOLD_MB') return '999999';
        if (key === 'DATABASE_PROVIDER') return 'postgresql';
        if (key === 'STORAGE_DRIVER') return 's3';
        if (key === 'S3_ENDPOINT') return 'http://localhost:9000/storage/v1/s3';
        if (key === 'RESEND_API_KEY') return 're_valid_api_key_123';
        if (key === 'EMAIL_FROM') return 'noreply@example.com';
        if (key === 'ASAAS_API_KEY') return 'asaas_test_key';
        if (key === 'ASAAS_SANDBOX') return 'true';
        return defaultValue;
      });

      (axios.get as jest.Mock).mockResolvedValue({ status: 403, data: {} });

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.detailed()) as any;

      expect(result.storage).toHaveProperty('status', 'up');
      expect(result.storage).toHaveProperty('driver', 's3');
      expect(axios.get).toHaveBeenCalledWith('http://localhost:9000', expect.any(Object));
    });

    it('deve verificar payment em ambiente production quando ASAAS_SANDBOX \u00e9 false', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([{ count: 15 }]);

      mockConfigService.get.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'HEALTH_MEMORY_THRESHOLD_MB') return '999999';
        if (key === 'DATABASE_PROVIDER') return 'postgresql';
        if (key === 'STORAGE_DRIVER') return 'local';
        if (key === 'S3_ENDPOINT') return defaultValue;
        if (key === 'RESEND_API_KEY') return 're_valid_api_key_123';
        if (key === 'EMAIL_FROM') return 'noreply@example.com';
        if (key === 'ASAAS_API_KEY') return 'asaas_test_key';
        if (key === 'ASAAS_SANDBOX') return 'false';
        return defaultValue;
      });

      (axios.get as jest.Mock).mockResolvedValue({ status: 200, data: {} });

      mockHealthCheckService.check.mockImplementation(async indicators => {
        const results: HealthIndicatorResult = {};
        for (const indicator of indicators) {
          const result = await indicator();
          Object.assign(results, result);
        }
        return results;
      });

      const result = (await controller.detailed()) as any;

      expect(result.payment).toHaveProperty('environment', 'production');
    });
  });
});
