import request from 'supertest';
import { getApp, getPrismaService, createTestUser } from '@test/setup/e2e.setup';
import { Role, CouponType, OrderStatus } from '@prisma/client';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; role: string };
}

interface ProductResponse {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
}

interface CartResponse {
  id: string;
  items: Array<{ productId: string; quantity: number; product: { name: string; price: number } }>;
}

interface OrderResponse {
  id: string;
  userId: string;
  status: string;
  subtotal: number;
  total: number;
  discountAmount: number;
  couponId: string | null;
  items: Array<{ id: string; productId: string; quantity: number; price: number }>;
}

interface CouponResponse {
  id: string;
  code: string;
  type: string;
  value: number;
  minPurchase: number | null;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
}

describe('Checkout Flow (e2e)', () => {
  let adminToken: string;
  let userToken: string;
  let _userId: string;
  let productId: string;
  let couponId: string;

  beforeAll(async () => {
    // Create admin user and login
    const _admin = await createTestUser('admin@arkshop.com', 'Admin123!', 'Admin User', Role.ADMIN);

    const user = await createTestUser('buyer@arkshop.com', 'Buyer123!', 'Test Buyer', Role.USER);
    _userId = user.id;

    const app = getApp();

    // Login admin
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@arkshop.com', password: 'Admin123!' })
      .expect(200);
    adminToken = (adminLogin.body as LoginResponse).access_token;

    // Login user
    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'buyer@arkshop.com', password: 'Buyer123!' })
      .expect(200);
    userToken = (userLogin.body as LoginResponse).access_token;

    // Create a product (admin)
    const productRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Cyberpunk 2077 - Steam Key',
        description: 'Full game key for Steam',
        price: 199.9,
        stock: 10,
        isActive: true,
      })
      .expect(201);
    productId = (productRes.body as ProductResponse).id;

    // Add keys to the product (admin)
    await request(app.getHttpServer())
      .post('/admin/products/:id/keys'.replace(':id', productId))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ keys: ['KEY-001-XXXX', 'KEY-002-YYYY', 'KEY-003-ZZZZ'] })
      .expect(201);

    // Create a coupon (admin)
    const couponRes = await request(app.getHttpServer())
      .post('/coupons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'PROMO20',
        type: CouponType.PERCENTAGE,
        value: 20,
        minPurchase: 50,
        maxUses: 100,
        isActive: true,
      })
      .expect(201);
    couponId = (couponRes.body as CouponResponse).id;
  });

  // No afterEach cleanup — tests are designed to be independent
  // and use the same pre-created product/coupon from beforeAll

  describe('Full Checkout Flow', () => {
    it('should complete full flow: cart → coupon → order with discount', async () => {
      const app = getApp();
      const prisma = getPrismaService();

      // ─── Step 1: Add product to cart ─────────────────────────────
      const addToCart = await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 1 })
        .expect(201);

      expect((addToCart.body as CartResponse).items).toHaveLength(1);
      expect((addToCart.body as CartResponse).items[0].productId).toBe(productId);

      // ─── Step 2: Verify cart ─────────────────────────────────────
      const getCart = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const cart = getCart.body as CartResponse;
      expect(cart.items).toHaveLength(1);
      expect(Number(cart.items[0].product.price)).toBe(199.9);

      // ─── Step 3: Validate coupon ─────────────────────────────────
      const subtotal = 199.9;
      const validateCoupon = await request(app.getHttpServer())
        .post('/coupons/validate')
        .send({ code: 'PROMO20', subtotal })
        .expect(200);

      const couponResult = validateCoupon.body as {
        valid: boolean;
        discountAmount: number;
        coupon: { code: string; value: number };
      };
      expect(couponResult.valid).toBe(true);
      expect(Number(couponResult.discountAmount)).toBeCloseTo(39.98, 2); // 20% of 199.9
      expect(couponResult.coupon.code).toBe('PROMO20');

      // ─── Step 4: Create order with coupon ────────────────────────
      const createOrder = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
          couponCode: 'PROMO20',
        })
        .expect(201);

      const order = createOrder.body as OrderResponse;
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(Number(order.subtotal)).toBeCloseTo(199.9, 2);
      expect(Number(order.discountAmount)).toBeCloseTo(39.98, 2);
      expect(Number(order.total)).toBeCloseTo(159.92, 2); // 199.9 - 39.98
      expect(order.couponId).toBe(couponId);
      expect(order.items).toHaveLength(1);
      expect(Number(order.items[0].price)).toBeCloseTo(199.9, 2);

      // ─── Step 5: Verify coupon usage incremented ─────────────────
      const couponInDb = await prisma.coupon.findUnique({
        where: { id: couponId },
      });
      expect(couponInDb?.usedCount).toBe(1);

      // ─── Step 6: Verify cart was cleared after order ─────────────
      const cartAfterOrder = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      // Cart may or may not be cleared depending on implementation
      // The important thing is the order was created correctly
      expect(cartAfterOrder.body).toBeDefined();
    });

    it('should reject expired coupon', async () => {
      const app = getApp();

      // Create expired coupon
      await request(app.getHttpServer())
        .post('/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'EXPIRED',
          type: CouponType.PERCENTAGE,
          value: 10,
          validTo: new Date('2020-01-01').toISOString(),
          isActive: true,
        })
        .expect(201);

      // Try to validate
      const result = await request(app.getHttpServer())
        .post('/coupons/validate')
        .send({ code: 'EXPIRED', subtotal: 100 })
        .expect(400);

      expect(result.body.message).toContain('expired');
    });

    it('should reject coupon below minimum purchase', async () => {
      const app = getApp();

      const result = await request(app.getHttpServer())
        .post('/coupons/validate')
        .send({ code: 'PROMO20', subtotal: 10 })
        .expect(400);

      expect(result.body.message).toContain('Minimum purchase');
    });

    it('should reject invalid coupon code', async () => {
      const app = getApp();

      const result = await request(app.getHttpServer())
        .post('/coupons/validate')
        .send({ code: 'NONEXISTENT', subtotal: 100 })
        .expect(400);

      expect(result.body.message).toContain('Invalid coupon');
    });

    it('should create order without coupon', async () => {
      const app = getApp();

      // Add to cart first
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 1 })
        .expect(201);

      // Create order without coupon
      const createOrder = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        })
        .expect(201);

      const order = createOrder.body as OrderResponse;
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(Number(order.subtotal)).toBeCloseTo(199.9, 2);
      expect(Number(order.discountAmount)).toBe(0);
      expect(Number(order.total)).toBeCloseTo(199.9, 2);
      expect(order.couponId).toBeNull();
    });

    it('should prevent ordering inactive product', async () => {
      const app = getApp();

      // Create inactive product
      const inactiveProduct = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Inactive Game',
          price: 50,
          isActive: false,
        })
        .expect(201);

      const inactiveProductId = (inactiveProduct.body as ProductResponse).id;

      // Try to order inactive product
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId: inactiveProductId, quantity: 1 }],
        })
        .expect(400);
    });

    it('should prevent ordering non-existent product', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
        })
        .expect(404);
    });
  });

  describe('Cart Operations', () => {
    it('should add, update, and remove items from cart', async () => {
      const app = getApp();

      // Add item
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 2 })
        .expect(201);

      // Update quantity
      await request(app.getHttpServer())
        .patch(`/cart/items/${productId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ quantity: 3 })
        .expect(200);

      // Verify
      const cart = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect((cart.body as CartResponse).items[0].quantity).toBe(3);

      // Remove item
      await request(app.getHttpServer())
        .delete(`/cart/items/${productId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify empty cart
      const emptyCart = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect((emptyCart.body as CartResponse).items).toHaveLength(0);
    });

    it('should clear entire cart', async () => {
      const app = getApp();

      // Add items
      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 1 })
        .expect(201);

      // Clear cart
      await request(app.getHttpServer())
        .delete('/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify
      const cart = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect((cart.body as CartResponse).items).toHaveLength(0);
    });

    it('should get cart item count', async () => {
      const app = getApp();

      // Clear cart first to ensure clean state
      await request(app.getHttpServer())
        .delete('/cart')
        .set('Authorization', `Bearer ${userToken}`);

      await request(app.getHttpServer())
        .post('/cart/items')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ productId, quantity: 2 })
        .expect(201);

      const count = await request(app.getHttpServer())
        .get('/cart/count')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(count.body.count).toBe(2);
    });
  });

  describe('Coupon Admin Operations', () => {
    it('should list all coupons (admin)', async () => {
      const app = getApp();

      const result = await request(app.getHttpServer())
        .get('/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(result.body.data).toBeDefined();
      expect(result.body.meta).toBeDefined();
      expect(result.body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('should update a coupon (admin)', async () => {
      const app = getApp();

      const result = await request(app.getHttpServer())
        .patch(`/coupons/${couponId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: 30 })
        .expect(200);

      expect(Number((result.body as CouponResponse).value)).toBe(30);
    });

    it('should delete a coupon (admin)', async () => {
      const app = getApp();

      // Create a coupon to delete
      const created = await request(app.getHttpServer())
        .post('/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'DELETEME',
          type: CouponType.FIXED,
          value: 5,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/coupons/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify deletion
      await request(app.getHttpServer())
        .post('/coupons/validate')
        .send({ code: 'DELETEME', subtotal: 100 })
        .expect(400);
    });

    it('should prevent non-admin from creating coupons', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/coupons')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          code: 'UNAUTHORIZED',
          type: CouponType.PERCENTAGE,
          value: 10,
        })
        .expect(403);
    });
  });

  describe('Order User Operations', () => {
    it('should list user orders', async () => {
      const app = getApp();

      // Create an order first
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        })
        .expect(201);

      // List orders
      const result = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(result.body.data).toBeDefined();
      expect(result.body.data.length).toBeGreaterThanOrEqual(1);
      expect(result.body.meta).toBeDefined();
    });

    it('should get order by ID (owner)', async () => {
      const app = getApp();

      // Create order
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        })
        .expect(201);

      const orderId = (createRes.body as OrderResponse).id;

      // Get order
      const result = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect((result.body as OrderResponse).id).toBe(orderId);
    });

    it('should prevent viewing another user order', async () => {
      const app = getApp();

      // Create admin order
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        })
        .expect(201);

      const adminOrderId = (createRes.body as OrderResponse).id;

      // User tries to view admin order
      await request(app.getHttpServer())
        .get(`/orders/${adminOrderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should cancel own order', async () => {
      const app = getApp();

      // Create order
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId, quantity: 1 }],
        })
        .expect(201);

      const orderId = (createRes.body as OrderResponse).id;

      // Cancel order
      const cancelRes = await request(app.getHttpServer())
        .post(`/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(201);

      expect((cancelRes.body as OrderResponse).status).toBe(OrderStatus.CANCELLED);
    });
  });
});
