import request from 'supertest';
import { getApp, getPrismaService } from '@test/setup/e2e.setup';

describe('ContactController (e2e)', () => {
  const prisma = getPrismaService();

  afterEach(async () => {
    await prisma.contact.deleteMany({});
  });

  describe('POST /contact', () => {
    it('should send contact message successfully', async () => {
      const app = getApp();

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

      // Verify message was saved in DB
      const contactInDb = await prisma.contact.findFirst({
        where: { email: 'test@example.com' },
      });
      expect(contactInDb).toBeDefined();
      expect(contactInDb?.name).toBe('Test User');
      expect(contactInDb?.subject).toBe('Test Subject');
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
