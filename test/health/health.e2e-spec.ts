import request from 'supertest';
import { getApp } from '@test/setup/e2e.setup';

describe('HealthController (e2e)', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer()).get('/health');

      // Health endpoint may return 200 (all healthy) or 503 (if DB is temporarily unavailable)
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer()).get('/health/ready');

      // Readiness probe may return 200 (ready) or 503 (if DB is temporarily unavailable)
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('GET /health/detailed', () => {
    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).get('/health/detailed').expect(401);
    });
  });
});
