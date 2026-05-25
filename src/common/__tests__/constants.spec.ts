import { getSaltRounds, DEFAULT_BCRYPT_SALT_ROUNDS } from '@/common/constants';

describe('getSaltRounds', () => {
  it('should return valid salt rounds from environment', () => {
    const mockConfig = { get: () => '12' };
    expect(getSaltRounds(mockConfig)).toBe(12);
  });

  it('should fall back to default when value is NaN', () => {
    const mockConfig = { get: () => 'abc' };
    const result = getSaltRounds(mockConfig);
    expect(result).toBe(DEFAULT_BCRYPT_SALT_ROUNDS);
    expect(Number.isNaN(result)).toBe(false);
  });

  it('should fall back to default when value is below minimum (4)', () => {
    const mockConfig = { get: () => '3' };
    expect(getSaltRounds(mockConfig)).toBe(DEFAULT_BCRYPT_SALT_ROUNDS);
  });

  it('should fall back to default when value exceeds maximum (31)', () => {
    const mockConfig = { get: () => '32' };
    expect(getSaltRounds(mockConfig)).toBe(DEFAULT_BCRYPT_SALT_ROUNDS);
  });

  it('should fall back to default when config is undefined', () => {
    const mockConfig = { get: () => undefined };
    expect(getSaltRounds(mockConfig)).toBe(DEFAULT_BCRYPT_SALT_ROUNDS);
  });

  it('should handle boundary values (4 and 31)', () => {
    expect(getSaltRounds({ get: () => '4' })).toBe(4);
    expect(getSaltRounds({ get: () => '31' })).toBe(31);
  });
});
