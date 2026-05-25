import request from 'supertest';
import { getApp, getPrismaService, createTestUser } from '@test/setup/e2e.setup';
import { Role } from '@prisma/client';

interface LoginResponse {
  access_token: string;
  user: { id: string; email: string; role: string };
}

interface PaymentResponse {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  provider: string;
  method: string;
  status: string;
}

interface PaginatedPaymentsResponse {
  data: PaymentResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

describe('PaymentsController (e2e)', () => {
  let prisma: ReturnType<typeof getPrismaService>;
  let adminToken: string;
  let userToken: string;
  let userId: string;
  let orderId: string;

  beforeEach(() => {
    prisma = getPrismaService();
  });

  beforeAll(async () => {
    const app = getApp();

    // Create admin user
    await createTestUser('admin-pay@example.com', 'Admin123!', 'Admin', Role.ADMIN);

    // Create regular user
    const user = await createTestUser(
      'user-pay@example.com',
      'User123!',
      'Regular User',
      Role.USER,
    );
    userId = user.id;

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin-pay@example.com', password: 'Admin123!' })
      .expect(200);

    adminToken = (adminLogin.body as LoginResponse).access_token;

    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user-pay@example.com', password: 'User123!' })
      .expect(200);

    userToken = (userLogin.body as LoginResponse).access_token;
  });

  beforeEach(async () => {
    await prisma.payment.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('POST /payments/:orderId', () => {
    beforeEach(async () => {
      const order = await prisma.order.create({
        data: {
          userId,
          total: 100,
          subtotal: 100,
          status: 'PENDING',
        },
      });
      orderId = order.id;
    });

    it('should create payment for order', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post(`/payments/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 100,
          provider: 'ASAAS',
          method: 'CREDIT_CARD',
          payerCpf: '12345678901',
        })
        .expect(201);

      const body = response.body as PaymentResponse;
      expect(body).toHaveProperty('id');
      expect(body.orderId).toBe(orderId);
      expect(body.amount).toBe(100);
      expect(body.provider).toBe('ASAAS');
    });

    it('should create payment with PIX method', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post(`/payments/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 100,
          provider: 'ASAAS',
          method: 'PIX',
          payerCpf: '12345678901',
        })
        .expect(201);

      const body = response.body as PaymentResponse;
      expect(body.method).toBe('PIX');
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post(`/payments/${orderId}`)
        .send({ amount: 100, provider: 'ASAAS', method: 'PIX' })
        .expect(401);
    });

    it('should return 400 for invalid order ID format', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/payments/invalid-uuid')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 100, provider: 'ASAAS', method: 'PIX' })
        .expect(400);
    });
  });

  describe('GET /payments/:id', () => {
    let paymentId: string;

    beforeEach(async () => {
      const order = await prisma.order.create({
        data: { userId, total: 50, subtotal: 50, status: 'PENDING' },
      });

      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          userId,
          amount: 50,
          provider: 'ASAAS',
          method: 'PIX',
          status: 'PENDING',
        },
      });
      paymentId = payment.id;
    });

    it('should return payment by ID', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get(`/payments/${paymentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const body = response.body as PaymentResponse;
      expect(body.id).toBe(paymentId);
      expect(body.amount).toBe(50);
    });

    it('should return 404 for non-existing payment', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .get('/payments/non-existing-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).get(`/payments/${paymentId}`).expect(401);
    });
  });

  describe('GET /payments/order/:orderId', () => {
    beforeEach(async () => {
      const order = await prisma.order.create({
        data: { userId, total: 75, subtotal: 75, status: 'PENDING' },
      });

      await prisma.payment.create({
        data: {
          orderId: order.id,
          userId,
          amount: 75,
          provider: 'ASAAS',
          method: 'CREDIT_CARD',
          status: 'APPROVED',
        },
      });
      orderId = order.id;
    });

    it('should return payment by order ID', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get(`/payments/order/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const body = response.body as PaymentResponse;
      expect(body.orderId).toBe(orderId);
    });

    it('should return 404 for order without payment', async () => {
      const app = getApp();

      const newOrder = await prisma.order.create({
        data: { userId, total: 25, subtotal: 25, status: 'PENDING' },
      });

      await request(app.getHttpServer())
        .get(`/payments/order/${newOrder.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).get(`/payments/order/${orderId}`).expect(401);
    });
  });

  describe('POST /payments/:id/refund', () => {
    let paymentId: string;

    beforeEach(async () => {
      const order = await prisma.order.create({
        data: { userId, total: 200, subtotal: 200, status: 'PAID' },
      });

      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          userId,
          amount: 200,
          provider: 'ASAAS',
          method: 'CREDIT_CARD',
          status: 'APPROVED',
          providerTxId: 'mock-provider-tx-id', // Required for refund
        },
      });
      paymentId = payment.id;
    });

    it('should refund payment as admin', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post(`/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 200 })
        .expect(200);

      const body = response.body;
      expect(body.payment.status).toBe('REFUNDED');
    });

    it('should refund partial amount', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post(`/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 100 })
        .expect(200);

      const body = response.body;
      expect(body.payment.status).toBe('REFUNDED');
    });

    it('should return 403 for non-admin user', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post(`/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ amount: 200 })
        .expect(403);
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post(`/payments/${paymentId}/refund`)
        .send({ amount: 200 })
        .expect(401);
    });
  });

  describe('GET /payments/user/:userId', () => {
    beforeEach(async () => {
      // Create multiple payments for the user
      for (let i = 0; i < 3; i++) {
        const order = await prisma.order.create({
          data: { userId, total: 50 + i * 10, subtotal: 50 + i * 10, status: 'PAID' },
        });

        await prisma.payment.create({
          data: {
            orderId: order.id,
            userId,
            amount: 50 + i * 10,
            provider: 'ASAAS',
            method: 'PIX',
            status: 'APPROVED',
          },
        });
      }
    });

    it('should return paginated payments for user (admin)', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get(`/payments/user/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedPaymentsResponse;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.data.length).toBe(3);
      expect(body.meta.total).toBe(3);
    });

    it('should support pagination params', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get(`/payments/user/${userId}?page=1&limit=2`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedPaymentsResponse;
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.meta.limit).toBe(2);
    });

    it('should return 403 for non-admin user', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .get(`/payments/user/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).get(`/payments/user/${userId}`).expect(401);
    });
  });

  describe('POST /payments/webhook/:provider', () => {
    it('should ignore non-asaas providers', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/payments/webhook/stripe')
        .send({ event: 'payment.completed' })
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ignored');
      expect(response.body).toHaveProperty('provider', 'stripe');
    });

    it('should return 401 for asaas webhook with invalid signature', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/payments/webhook/asaas')
        .set('x-webhook-signature', 'invalid-signature')
        .send({ event: 'payment.completed' })
        .expect(401);
    });
  });
});
