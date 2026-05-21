import request from 'supertest';
import { getApp, getPrismaService, createTestUser } from '@test/setup/e2e.setup';
import { Role } from '@prisma/client';

interface LoginResponse {
  access_token: string;
  user: { id: string; email: string; role: string };
}

describe('MetricsController (e2e)', () => {
  describe('GET /metrics', () => {
    it('should return metrics (public endpoint)', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer()).get('/metrics').expect(200);

      // Metrics endpoint typically returns Prometheus-format text
      expect(typeof response.text).toBe('string');
    });
  });

  describe('GET /metrics/admin', () => {
    let adminToken: string;
    let userToken: string;

    beforeAll(async () => {
      const app = getApp();

      await createTestUser('admin-metrics@example.com', 'Admin123!', 'Admin', Role.ADMIN);
      await createTestUser('user-metrics@example.com', 'User123!', 'User', Role.USER);

      const adminLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin-metrics@example.com', password: 'Admin123!' })
        .expect(200);

      adminToken = (adminLogin.body as LoginResponse).access_token;

      const userLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user-metrics@example.com', password: 'User123!' })
        .expect(200);

      userToken = (userLogin.body as LoginResponse).access_token;
    });

    afterAll(async () => {
      const prisma = getPrismaService();
      await prisma.refreshToken.deleteMany({});
      await prisma.user.deleteMany({});
    });

    it('should return admin metrics for admin user', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get('/metrics/admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should return 403 for non-admin user', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .get('/metrics/admin')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).get('/metrics/admin').expect(401);
    });
  });
});
