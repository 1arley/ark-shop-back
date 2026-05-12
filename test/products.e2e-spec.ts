import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ConfigService } from '@nestjs/config';

describe('Products E2E', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn().mockReturnValue('test-value'),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = new PrismaClient();

    await app.init();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.key.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
  });

  describe('POST /api/products', () => {
    it('should create a product', () => {
      return request(app.getHttpServer())
        .post('/api/products')
        .send({
          name: 'Test Product',
          price: 29.99,
          description: 'Test Description',
        })
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Test Product');
          expect(res.body.price).toBe(29.99);
        });
    });

    it('should fail validation without name', () => {
      return request(app.getHttpServer()).post('/api/products').send({ price: 29.99 }).expect(400);
    });

    it('should fail validation without price', () => {
      return request(app.getHttpServer())
        .post('/api/products')
        .send({ name: 'Test Product' })
        .expect(400);
    });
  });

  describe('GET /api/products', () => {
    it('should return empty array when no products', () => {
      return request(app.getHttpServer())
        .get('/api/products')
        .expect(200)
        .expect(res => {
          expect(res.body.data).toEqual([]);
        });
    });

    it('should return products after creation', async () => {
      // Create a product first
      await request(app.getHttpServer()).post('/api/products').send({
        name: 'Test Product',
        price: 29.99,
      });

      return request(app.getHttpServer())
        .get('/api/products')
        .expect(200)
        .expect(res => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.data[0].name).toBe('Test Product');
        });
    });
  });

  describe('GET /api/products/:id', () => {
    it('should return product by id', async () => {
      const createResponse = await request(app.getHttpServer()).post('/api/products').send({
        name: 'Test Product',
        price: 29.99,
      });

      const productId = createResponse.body.id;

      return request(app.getHttpServer())
        .get(`/api/products/${productId}`)
        .expect(200)
        .expect(res => {
          expect(res.body.id).toBe(productId);
          expect(res.body.name).toBe('Test Product');
        });
    });

    it('should return 404 for non-existent product', () => {
      return request(app.getHttpServer()).get('/api/products/non-existent-id').expect(404);
    });
  });

  describe('PATCH /api/products/:id', () => {
    it('should update product', async () => {
      const createResponse = await request(app.getHttpServer()).post('/api/products').send({
        name: 'Test Product',
        price: 29.99,
      });

      const productId = createResponse.body.id;

      return request(app.getHttpServer())
        .patch(`/api/products/${productId}`)
        .send({ name: 'Updated Name' })
        .expect(200)
        .expect(res => {
          expect(res.body.name).toBe('Updated Name');
        });
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('should delete product', async () => {
      const createResponse = await request(app.getHttpServer()).post('/api/products').send({
        name: 'Test Product',
        price: 29.99,
      });

      const productId = createResponse.body.id;

      return request(app.getHttpServer()).delete(`/api/products/${productId}`).expect(200);
    });
  });
});
