import request from 'supertest';
import { getApp, getPrismaService, createTestUser } from '@test/setup/e2e.setup';
import { Role } from '@prisma/client';

interface LoginResponse {
  access_token: string;
  user: { id: string; email: string; role: string };
}

interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  isActive: boolean;
}

describe('CategoriesController (e2e)', () => {
  const prisma = getPrismaService();

  afterEach(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('POST /categories', () => {
    let adminToken: string;

    beforeEach(async () => {
      const app = getApp();
      await createTestUser('admin@example.com', 'Admin123!', 'Admin User', Role.ADMIN);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin123!' })
        .expect(200);

      adminToken = (loginResponse.body as LoginResponse).access_token;
    });

    it('should create a new category as admin', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Games',
          slug: 'games',
          description: 'Video games category',
        })
        .expect(201);

      const body = response.body as CategoryResponse;
      expect(body.name).toBe('Games');
      expect(body.slug).toBe('games');
      expect(body.description).toBe('Video games category');
      expect(body.isActive).toBe(true);

      const categoryInDb = await prisma.category.findUnique({ where: { id: body.id } });
      expect(categoryInDb).toBeDefined();
      expect(categoryInDb?.name).toBe('Games');
    });

    it('should create a subcategory with parentId', async () => {
      const app = getApp();

      const parentResponse = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Electronics', slug: 'electronics' })
        .expect(201);

      const parentId = (parentResponse.body as CategoryResponse).id;

      const response = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Phones', slug: 'phones', parentId })
        .expect(201);

      const body = response.body as CategoryResponse;
      expect(body.parentId).toBe(parentId);
    });

    it('should return 400 for missing required fields', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });

    it('should return 403 for non-admin user', async () => {
      const app = getApp();
      await createTestUser('user@example.com', 'User123!', 'Regular User', Role.USER);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'User123!' })
        .expect(200);

      const userToken = (loginResponse.body as LoginResponse).access_token;

      await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Test', slug: 'test' })
        .expect(403);
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Test', slug: 'test' })
        .expect(401);
    });
  });

  describe('GET /categories', () => {
    beforeEach(async () => {
      await prisma.category.createMany({
        data: [
          { name: 'Games', slug: 'games', isActive: true },
          { name: 'Software', slug: 'software', isActive: true },
          { name: 'Hardware', slug: 'hardware', isActive: true },
        ],
      });
    });

    it('should return all categories', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer()).get('/categories').expect(200);

      const body = response.body as CategoryResponse[];
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(3);
    });

    it('should return empty array when no categories exist', async () => {
      const app = getApp();
      await prisma.category.deleteMany();

      const response = await request(app.getHttpServer()).get('/categories').expect(200);

      const body = response.body as CategoryResponse[];
      expect(body).toEqual([]);
    });
  });

  describe('GET /categories/root', () => {
    beforeEach(async () => {
      const parent = await prisma.category.create({
        data: { name: 'Parent', slug: 'parent', isActive: true },
      });

      await prisma.category.createMany({
        data: [
          { name: 'Child 1', slug: 'child-1', parentId: parent.id, isActive: true },
          { name: 'Child 2', slug: 'child-2', parentId: parent.id, isActive: true },
        ],
      });
    });

    it('should return only root categories (no parentId)', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer()).get('/categories/root').expect(200);

      const body = response.body as CategoryResponse[];
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(1);
      expect(body[0].name).toBe('Parent');
    });
  });

  describe('GET /categories/:id', () => {
    let categoryId: string;

    beforeEach(async () => {
      const category = await prisma.category.create({
        data: { name: 'Test Category', slug: 'test-category', isActive: true },
      });
      categoryId = category.id;
    });

    it('should return category by ID', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get(`/categories/${categoryId}`)
        .expect(200);

      const body = response.body as CategoryResponse;
      expect(body.id).toBe(categoryId);
      expect(body.name).toBe('Test Category');
    });

    it('should return 404 for non-existing category', async () => {
      const app = getApp();

      await request(app.getHttpServer()).get('/categories/non-existing-id').expect(404);
    });
  });

  describe('PATCH /categories/:id', () => {
    let adminToken: string;
    let categoryId: string;

    beforeEach(async () => {
      const app = getApp();
      await createTestUser('admin@example.com', 'Admin123!', 'Admin User', Role.ADMIN);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin123!' })
        .expect(200);

      adminToken = (loginResponse.body as LoginResponse).access_token;

      const category = await prisma.category.create({
        data: { name: 'Original', slug: 'original', isActive: true },
      });
      categoryId = category.id;
    });

    it('should update category name', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .patch(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      const body = response.body as CategoryResponse;
      expect(body.name).toBe('Updated Name');
    });

    it('should update category description', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .patch(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'New description' })
        .expect(200);

      const body = response.body as CategoryResponse;
      expect(body.description).toBe('New description');
    });

    it('should return 404 for non-existing category', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .patch('/categories/non-existing-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });

    it('should return 403 for non-admin user', async () => {
      const app = getApp();
      await createTestUser('user@example.com', 'User123!', 'Regular User', Role.USER);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'User123!' })
        .expect(200);

      const userToken = (loginResponse.body as LoginResponse).access_token;

      await request(app.getHttpServer())
        .patch(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated' })
        .expect(403);
    });
  });

  describe('DELETE /categories/:id', () => {
    let adminToken: string;
    let categoryId: string;

    beforeEach(async () => {
      const app = getApp();
      await createTestUser('admin@example.com', 'Admin123!', 'Admin User', Role.ADMIN);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin123!' })
        .expect(200);

      adminToken = (loginResponse.body as LoginResponse).access_token;

      const category = await prisma.category.create({
        data: { name: 'To Delete', slug: 'to-delete', isActive: true },
      });
      categoryId = category.id;
    });

    it('should delete category', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .delete(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const category = await prisma.category.findUnique({ where: { id: categoryId } });
      expect(category).toBeNull();
    });

    it('should return 400 if category has products', async () => {
      const app = getApp();

      await prisma.product.create({
        data: {
          name: 'Test Product',
          slug: 'test-product',
          price: 100,
          categoryId,
          sellerId: 'system',
        },
      });

      await request(app.getHttpServer())
        .delete(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 400 if category has subcategories', async () => {
      const app = getApp();

      await prisma.category.create({
        data: { name: 'Subcategory', slug: 'subcategory', parentId: categoryId, isActive: true },
      });

      await request(app.getHttpServer())
        .delete(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 403 for non-admin user', async () => {
      const app = getApp();
      await createTestUser('user@example.com', 'User123!', 'Regular User', Role.USER);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'User123!' })
        .expect(200);

      const userToken = (loginResponse.body as LoginResponse).access_token;

      await request(app.getHttpServer())
        .delete(`/categories/${categoryId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
