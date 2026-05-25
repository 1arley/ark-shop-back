import request from 'supertest';
import { getApp, getPrismaService, createTestUser } from '@test/setup/e2e.setup';
import { Role } from '@prisma/client';

interface LoginResponse {
  access_token: string;
  user: { id: string; email: string; role: string };
}

interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

interface PaginatedResponse {
  data: UserResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

describe('UserController (e2e)', () => {
  let prisma: ReturnType<typeof getPrismaService>;

  beforeEach(() => {
    prisma = getPrismaService();
  });

  afterEach(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('GET /user/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      const app = getApp();
      await createTestUser('profile@example.com', 'Password123!', 'Profile User');

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'profile@example.com', password: 'Password123!' })
        .expect(200);

      accessToken = (loginResponse.body as LoginResponse).access_token;
    });

    it('should return current user profile', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get('/user/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as UserResponse;
      expect(body).toHaveProperty('id');
      expect(body.email).toBe('profile@example.com');
      expect(body.name).toBe('Profile User');
      expect(body).not.toHaveProperty('password');
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).get('/user/me').expect(401);
    });
  });

  describe('PATCH /user/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      const app = getApp();
      await createTestUser('update@example.com', 'Password123!', 'Update User');

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'update@example.com', password: 'Password123!' })
        .expect(200);

      accessToken = (loginResponse.body as LoginResponse).access_token;
    });

    it('should update user name', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .patch('/user/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'New Name' })
        .expect(200);

      const body = response.body as UserResponse;
      expect(body.name).toBe('New Name');
      expect(body.email).toBe('update@example.com');
    });

    it('should update user email', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .patch('/user/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'newemail@example.com' })
        .expect(200);

      const body = response.body as UserResponse;
      expect(body.email).toBe('newemail@example.com');
    });

    it('should update avatar URL', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .patch('/user/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ avatarUrl: 'https://example.com/avatar.jpg' })
        .expect(200);

      const body = response.body as UserResponse;
      expect(body).toHaveProperty('avatarUrl', 'https://example.com/avatar.jpg');
    });

    it('should return 409 when updating to existing email', async () => {
      const app = getApp();
      await createTestUser('other@example.com', 'Password123!', 'Other User');

      await request(app.getHttpServer())
        .patch('/user/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'other@example.com' })
        .expect(409);
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).patch('/user/me').send({ name: 'New Name' }).expect(401);
    });

    it('should reject unknown fields (whitelist validation)', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .patch('/user/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'New Name', role: 'ADMIN' })
        .expect(400);
    });
  });

  describe('DELETE /user/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      const app = getApp();
      await createTestUser('delete@example.com', 'Password123!', 'Delete User');

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'delete@example.com', password: 'Password123!' })
        .expect(200);

      accessToken = (loginResponse.body as LoginResponse).access_token;
    });

    it('should delete own account', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .delete('/user/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Usuário removido com sucesso.');

      // Verify user was deleted
      const user = await prisma.user.findUnique({
        where: { email: 'delete@example.com' },
      });
      expect(user).toBeNull();
    });

    it('should return 409 if user has orders', async () => {
      const app = getApp();
      const user = await prisma.user.findUnique({ where: { email: 'delete@example.com' } });

      // Create an order for the user
      await prisma.order.create({
        data: {
          userId: user!.id,
          total: 100,
          subtotal: 100,
          status: 'PENDING',
        },
      });

      await request(app.getHttpServer())
        .delete('/user/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(409);

      // Verify user still exists
      const userAfter = await prisma.user.findUnique({
        where: { email: 'delete@example.com' },
      });
      expect(userAfter).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).delete('/user/me').expect(401);
    });
  });

  describe('GET /user (Admin only)', () => {
    let adminToken: string;
    let userToken: string;

    beforeEach(async () => {
      const app = getApp();

      // Create admin user
      await createTestUser('admin@example.com', 'Admin123!', 'Admin User', Role.ADMIN);

      // Create regular user
      await createTestUser('user@example.com', 'User123!', 'Regular User', Role.USER);

      // Create more users for pagination
      for (let i = 0; i < 5; i++) {
        await createTestUser(`user${i}@example.com`, 'User123!', `User ${i}`, Role.USER);
      }

      const adminLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin123!' })
        .expect(200);

      adminToken = (adminLogin.body as LoginResponse).access_token;

      const userLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'User123!' })
        .expect(200);

      userToken = (userLogin.body as LoginResponse).access_token;
    });

    it('should return paginated list of users for admin', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.meta.total).toBeGreaterThan(0);
      expect(body.meta).toHaveProperty('page');
      expect(body.meta).toHaveProperty('limit');
      expect(body.meta).toHaveProperty('totalPages');
    });

    it('should support pagination with page and limit params', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get('/user?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse;
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.meta.limit).toBe(2);
      expect(body.meta.page).toBe(1);
    });

    it('should return 403 for non-admin user', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).get('/user').expect(401);
    });

    it('should not expose passwords in user list', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse;
      for (const user of body.data) {
        expect(user).not.toHaveProperty('password');
      }
    });
  });
});
