import request from 'supertest';
import { getApp, getPrismaService, createTestUser } from '@test/setup/e2e.setup';
import { Role } from '@prisma/client';

describe('ContactController (e2e)', () => {
  let prisma: ReturnType<typeof getPrismaService>;

  beforeEach(() => {
    prisma = getPrismaService();
  });

  afterEach(async () => {
    await prisma.notification.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('POST /contact', () => {
    it('should send contact message successfully', async () => {
      const app = getApp();

      // Create admin user so the contact service creates notification records
      await createTestUser('admin@arkshop.com', 'Admin123!', 'Admin User', Role.ADMIN);

      const response = await request(app.getHttpServer())
        .post('/contact')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          subject: 'Test Subject',
          message: 'This is a test message.',
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // ContactService creates notification records for admins
      const notifications = await prisma.notification.findMany({
        where: { subject: { contains: 'Test Subject' } },
      });
      expect(notifications.length).toBeGreaterThan(0);
    });

    it('should return 400 for missing name', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/contact')
        .send({
          email: 'test@example.com',
          subject: 'Test',
          message: 'Message',
        })
        .expect(400);
    });

    it('should return 400 for missing email', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/contact')
        .send({
          name: 'Test User',
          subject: 'Test',
          message: 'Message',
        })
        .expect(400);
    });

    it('should return 400 for missing message', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/contact')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          subject: 'Test',
        })
        .expect(400);
    });

    it('should validate email format', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/contact')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          subject: 'Test',
          message: 'Message',
        })
        .expect(400);
    });

    it('should work without authentication (public endpoint)', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/contact')
        .send({
          name: 'Anonymous',
          email: 'anon@example.com',
          subject: 'No Auth',
          message: 'This should work without login.',
        })
        .expect(200);
    });
  });
});
