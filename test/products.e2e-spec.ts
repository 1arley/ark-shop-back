import request from 'supertest';
import { Role } from '@prisma/client';
import { getApp, getPrismaService, createTestUser, cleanupTestData } from '@test/setup/e2e.setup';

interface LoginResponse {
  access_token: string;
}

interface ProductResponse {
  id: string;
  name: string;
  price: number | string;
}

describe('Products E2E', () => {
  let adminToken: string;

  beforeAll(async () => {
    await createTestUser('products-admin@arkshop.com', 'Admin123!', 'Products Admin', Role.ADMIN);

    const app = getApp();
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'products-admin@arkshop.com', password: 'Admin123!' })
      .expect(200);

    adminToken = (login.body as LoginResponse).access_token;
  });

  beforeEach(async () => {
    const prisma = getPrismaService();
    await prisma.key.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('POST /products', () => {
    it('should create a product', async () => {
      const app = getApp();
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          price: 29.99,
          description: 'Test Description',
        })
        .expect(201);

      const body = response.body as ProductResponse;
      expect(body).toHaveProperty('id');
      expect(body.name).toBe('Test Product');
    });

    it('should fail validation without name', async () => {
      const app = getApp();
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 29.99 })
        .expect(400);
    });

    it('should fail validation without price', async () => {
      const app = getApp();
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Product' })
        .expect(400);
    });
  });

  describe('GET /products', () => {
    it('should return empty list when no products', async () => {
      const app = getApp();
      const response = await request(app.getHttpServer()).get('/products').expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should return products after creation', async () => {
      const app = getApp();
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Product', price: 29.99 });

      const response = await request(app.getHttpServer()).get('/products').expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Test Product');
    });
  });

  describe('GET /products/:id', () => {
    it('should return product by id', async () => {
      const app = getApp();
      const createResponse = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Product', price: 29.99 });

      const productId = (createResponse.body as ProductResponse).id;

      const response = await request(app.getHttpServer()).get(`/products/${productId}`).expect(200);

      expect(response.body.id).toBe(productId);
      expect(response.body.name).toBe('Test Product');
    });

    it('should return 404 for non-existent product', async () => {
      const app = getApp();
      await request(app.getHttpServer())
        .get('/products/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /products/:id', () => {
    it('should update product', async () => {
      const app = getApp();
      const createResponse = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Product', price: 29.99 });

      const productId = (createResponse.body as ProductResponse).id;

      const response = await request(app.getHttpServer())
        .patch(`/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
    });
  });

  describe('DELETE /products/:id', () => {
    it('should delete product', async () => {
      const app = getApp();
      const createResponse = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Product', price: 29.99 });

      const productId = (createResponse.body as ProductResponse).id;

      await request(app.getHttpServer())
        .delete(`/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
