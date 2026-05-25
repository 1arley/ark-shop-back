import request from 'supertest';
import { getApp, getPrismaService, createTestUser } from '@test/setup/e2e.setup';
import { Role } from '@prisma/client';
import { KeysEncryptionProvider } from '@/modules/keys/keys-encryption.provider';

interface LoginResponse {
  access_token: string;
  user: { id: string; email: string; role: string };
}

interface OrderResponse {
  id: string;
  userId: string;
  status: string;
  total: number;
  items: any[];
}

describe('OrdersController - Admin Endpoints (e2e)', () => {
  let prisma: ReturnType<typeof getPrismaService>;
  let adminToken: string;
  let userToken: string;
  let userId: string;

  beforeEach(() => {
    prisma = getPrismaService();
  });

  beforeAll(async () => {
    const app = getApp();

    const _admin = await createTestUser(
      'admin-orders@example.com',
      'Admin123!',
      'Admin',
      Role.ADMIN,
    );

    const user = await createTestUser(
      'user-orders@example.com',
      'User123!',
      'Regular User',
      Role.USER,
    );
    userId = user.id;

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin-orders@example.com', password: 'Admin123!' })
      .expect(200);

    adminToken = (adminLogin.body as LoginResponse).access_token;

    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user-orders@example.com', password: 'User123!' })
      .expect(200);

    userToken = (userLogin.body as LoginResponse).access_token;
  });

  beforeEach(async () => {
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.key.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.key.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('GET /orders/recent', () => {
    beforeEach(async () => {
      // Create orders for testing
      for (let i = 0; i < 5; i++) {
        await prisma.order.create({
          data: {
            userId,
            total: 100 + i,
            subtotal: 100 + i,
            status: 'PENDING',
          },
        });
      }
    });

    it('should return recent orders for admin', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get('/orders/recent')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as OrderResponse[];
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      expect(body.length).toBeLessThanOrEqual(10); // default limit
    });

    it('should support limit parameter', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get('/orders/recent?limit=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as OrderResponse[];
      expect(body.length).toBeLessThanOrEqual(2);
    });

    it('should return 403 for non-admin user', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .get('/orders/recent')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).get('/orders/recent').expect(401);
    });
  });

  describe('PATCH /orders/:id/status', () => {
    let orderId: string;

    beforeEach(async () => {
      const order = await prisma.order.create({
        data: {
          userId,
          total: 150,
          subtotal: 150,
          status: 'PENDING',
        },
      });
      orderId = order.id;
    });

    it('should update order status as admin', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'AWAITING_PAYMENT' })
        .expect(200);

      const body = response.body as OrderResponse;
      expect(body.status).toBe('AWAITING_PAYMENT');

      // Verify in DB
      const orderInDb = await prisma.order.findUnique({ where: { id: orderId } });
      expect(orderInDb?.status).toBe('AWAITING_PAYMENT');
    });

    it('should update status to DELIVERED', async () => {
      const app = getApp();

      // First transition to AWAITING_PAYMENT (valid from PENDING)
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'AWAITING_PAYMENT' })
        .expect(200);

      // Then to PAID
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PAID' })
        .expect(200);

      // Finally to DELIVERED
      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DELIVERED' })
        .expect(200);

      const body = response.body as OrderResponse;
      expect(body.status).toBe('DELIVERED');
    });

    it('should return 400 for invalid status', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });

    it('should return 404 for non-existing order', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .patch('/orders/non-existing-id/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'PROCESSING' })
        .expect(404);
    });

    it('should return 403 for non-admin user', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'PROCESSING' })
        .expect(403);
    });
  });

  describe('POST /orders/:id/deliver', () => {
    let orderId: string;
    let productId: string;

    beforeEach(async () => {
      const app = getApp();
      const encryptionProvider = app.get(KeysEncryptionProvider);

      const category = await prisma.category.create({
        data: { name: 'Games', slug: 'games' },
      });

      const product = await prisma.product.create({
        data: {
          name: 'Test Game',
          price: 50,
          categoryId: category.id,
        },
      });
      productId = product.id;

      // Create keys for the product (with encrypted keyData)
      await prisma.key.createMany({
        data: [
          { productId, keyData: encryptionProvider.encrypt('KEY-001'), status: 'AVAILABLE' },
          { productId, keyData: encryptionProvider.encrypt('KEY-002'), status: 'AVAILABLE' },
        ],
      });

      const order = await prisma.order.create({
        data: {
          userId,
          total: 50,
          subtotal: 50,
          status: 'PAID', // Must be PAID to deliver
        },
      });

      orderId = order.id;
    });

    it('should deliver order as admin', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post(`/orders/${orderId}/deliver`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as OrderResponse;
      expect(body.status).toBe('DELIVERED');

      // Verify order status in DB
      const orderInDb = await prisma.order.findUnique({ where: { id: orderId } });
      expect(orderInDb?.status).toBe('DELIVERED');
    });

    it('should return 403 for non-admin user', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post(`/orders/${orderId}/deliver`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 404 for non-existing order', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/orders/non-existing-id/deliver')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('GET /orders/:id/download', () => {
    let orderId: string;
    let productId: string;

    beforeEach(async () => {
      const app = getApp();
      const encryptionProvider = app.get(KeysEncryptionProvider);

      const category = await prisma.category.create({
        data: { name: 'Games', slug: 'games' },
      });

      const product = await prisma.product.create({
        data: {
          name: 'Downloadable Game',
          price: 30,
          categoryId: category.id,
        },
      });
      productId = product.id;

      await prisma.key.create({
        data: {
          productId,
          keyData: encryptionProvider.encrypt('DOWNLOAD-KEY-001'),
          status: 'AVAILABLE',
        },
      });

      const order = await prisma.order.create({
        data: {
          userId,
          total: 30,
          subtotal: 30,
          status: 'DELIVERED', // Must be delivered to download
        },
      });

      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId,
          quantity: 1,
          price: 30,
        },
      });

      // Assign key to order item (both sides of the relation)
      const orderItem = await prisma.orderItem.findFirst({ where: { orderId: order.id } });
      const key = await prisma.key.findFirst({ where: { productId, status: 'AVAILABLE' } });
      await prisma.key.update({
        where: { id: key!.id },
        data: { status: 'DELIVERED', orderItemId: orderItem!.id },
      });
      await prisma.orderItem.update({
        where: { id: orderItem!.id },
        data: { keyId: key!.id },
      });

      orderId = order.id;
    });

    it('should allow order owner to download keys', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get(`/orders/${orderId}/download`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('keys');
      expect(Array.isArray(response.body.keys)).toBe(true);
      expect(response.body.keys.length).toBeGreaterThan(0);
    });

    it('should return 403 for non-owner user', async () => {
      const app = getApp();

      // Create another user
      const _otherUser = await createTestUser('other-download@example.com', 'User123!', 'Other');
      const otherLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'other-download@example.com', password: 'User123!' })
        .expect(200);

      const otherToken = (otherLogin.body as LoginResponse).access_token;

      await request(app.getHttpServer())
        .get(`/orders/${orderId}/download`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });

    it('should return 400 if order is not delivered', async () => {
      const app = getApp();

      // Create undelivered order
      const undeliveredOrder = await prisma.order.create({
        data: {
          userId,
          total: 10,
          subtotal: 10,
          status: 'PAID',
        },
      });

      await request(app.getHttpServer())
        .get(`/orders/${undeliveredOrder.id}/download`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).get(`/orders/${orderId}/download`).expect(401);
    });
  });
});
