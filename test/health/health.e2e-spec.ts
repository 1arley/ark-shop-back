import request from 'supertest';
import { getApp } from '@test/setup/e2e.setup';

describe('HealthController (e2e)', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.body).toHaveProperty('status');
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

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
