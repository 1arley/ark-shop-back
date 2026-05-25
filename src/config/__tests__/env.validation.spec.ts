import { validateEnv } from '../env.validation';

describe('validateEnv', () => {
  const validConfig = {
    DATABASE_URL: 'postgresql://localhost:5432/test',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };

  it('should pass with valid config', () => {
    const result = validateEnv(validConfig);
    expect(result).toBeDefined();
  });

  it('should pass when ASAAS_WEBHOOK_SECRET is provided with ASAAS_API_KEY', () => {
    const config = {
      ...validConfig,
      ASAAS_API_KEY: 'some-api-key',
      ASAAS_WEBHOOK_SECRET: 'wh-secret-123',
    };

    expect(() => validateEnv(config)).not.toThrow();
  });
});
