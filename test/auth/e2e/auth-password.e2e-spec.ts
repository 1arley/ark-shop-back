import request from 'supertest';
import { getApp, getPrismaService, createTestUser } from '@test/setup/e2e.setup';
import * as crypto from 'crypto';

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string; role: string };
  emailVerified: boolean;
}

interface VerificationStatusResponse {
  email: string;
  emailVerified: boolean;
}

describe('AuthController - Password & Verification (e2e)', () => {
  const prisma = getPrismaService();

  afterEach(async () => {
    await prisma.refreshToken.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      const app = getApp();
      await createTestUser('logout@example.com', 'Password123!', 'Logout User');

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'logout@example.com', password: 'Password123!' })
        .expect(200);

      accessToken = (loginResponse.body as LoginResponse).access_token;
    });

    it('should logout successfully with valid token', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Logout realizado com sucesso.');

      // Verify refresh token was revoked
      const tokens = await prisma.refreshToken.findMany({
        where: { user: { email: 'logout@example.com' } },
      });
      expect(tokens).toHaveLength(0);
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('should clear cookies on logout', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
        const clearedCookies = cookies.filter(
          (c: string) => c.includes('access_token=') || c.includes('refresh_token='),
        );
        expect(clearedCookies.length).toBeGreaterThan(0);
      }
    });
  });

  describe('POST /auth/forgot-password', () => {
    beforeEach(async () => {
      await createTestUser('forgot@example.com', 'Password123!', 'Forgot User');
    });

    it('should return 200 for existing email', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'forgot@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify token was created in DB
      const tokens = await prisma.passwordResetToken.findMany({
        where: { user: { email: 'forgot@example.com' } },
      });
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should return same response for non-existing email (timing-safe)', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // No token should be created
      const tokens = await prisma.passwordResetToken.findMany({
        where: { user: { email: 'nonexistent@example.com' } },
      });
      expect(tokens).toHaveLength(0);
    });

    it('should validate email format', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'invalid-email' })
        .expect(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    let resetToken: string;

    beforeEach(async () => {
      await createTestUser('reset@example.com', 'OldPassword123!', 'Reset User');

      // Generate reset token directly in DB
      resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      const user = await prisma.user.findUnique({ where: { email: 'reset@example.com' } });

      await prisma.passwordResetToken.create({
        data: {
          userId: user!.id,
          token: tokenHash,
          expiresAt,
        },
      });
    });

    it('should reset password with valid token', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          email: 'reset@example.com',
          token: resetToken,
          password: 'NewPassword123!',
        })
        .expect(200);

      // Verify user can login with new password
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'reset@example.com', password: 'NewPassword123!' })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('access_token');

      // Verify old password no longer works
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'reset@example.com', password: 'OldPassword123!' })
        .expect(401);
    });

    it('should invalidate token after use', async () => {
      const app = getApp();

      // First use - should succeed
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          email: 'reset@example.com',
          token: resetToken,
          password: 'NewPassword123!',
        })
        .expect(200);

      // Second use - should fail
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          email: 'reset@example.com',
          token: resetToken,
          password: 'AnotherPassword123!',
        })
        .expect(400);
    });

    it('should return 400 for invalid token', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          email: 'reset@example.com',
          token: 'invalid-token',
          password: 'NewPassword123!',
        })
        .expect(400);
    });

    it('should revoke all refresh tokens after password reset', async () => {
      const app = getApp();

      // Login first to create refresh token
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'reset@example.com', password: 'OldPassword123!' })
        .expect(200);

      const tokensBefore = await prisma.refreshToken.findMany({
        where: { user: { email: 'reset@example.com' } },
      });
      expect(tokensBefore.length).toBeGreaterThan(0);

      // Reset password
      await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({
          email: 'reset@example.com',
          token: resetToken,
          password: 'NewPassword123!',
        })
        .expect(200);

      // Verify refresh tokens were revoked
      const tokensAfter = await prisma.refreshToken.findMany({
        where: { user: { email: 'reset@example.com' } },
      });
      expect(tokensAfter).toHaveLength(0);
    });
  });

  describe('POST /auth/forgot-password-code', () => {
    beforeEach(async () => {
      await createTestUser('otp-forgot@example.com', 'Password123!', 'OTP Forgot User');
    });

    it('should return 200 for existing email', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password-code')
        .send({ email: 'otp-forgot@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify code was created in DB
      const tokens = await prisma.passwordResetToken.findMany({
        where: { user: { email: 'otp-forgot@example.com' } },
      });
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should return same response for non-existing email', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/auth/forgot-password-code')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /auth/reset-password-code', () => {
    let resetCode: string;

    beforeEach(async () => {
      await createTestUser('otp-reset@example.com', 'OldPassword123!', 'OTP Reset User');

      // Generate reset code directly in DB
      resetCode = '123456';
      const codeHash = crypto.createHash('sha256').update(resetCode).digest('hex');
      const expiresAt = new Date(Date.now() + 900000); // 15 minutes

      const user = await prisma.user.findUnique({ where: { email: 'otp-reset@example.com' } });

      await prisma.passwordResetToken.create({
        data: {
          userId: user!.id,
          token: codeHash,
          expiresAt,
        },
      });
    });

    it('should reset password with valid OTP code', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/auth/reset-password-code')
        .send({
          email: 'otp-reset@example.com',
          code: resetCode,
          password: 'NewPassword123!',
        })
        .expect(200);

      // Verify user can login with new password
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'otp-reset@example.com', password: 'NewPassword123!' })
        .expect(200);
    });

    it('should return 400 for invalid code', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/auth/reset-password-code')
        .send({
          email: 'otp-reset@example.com',
          code: '999999',
          password: 'NewPassword123!',
        })
        .expect(400);
    });
  });

  describe('POST /auth/verify-email', () => {
    let verificationCode: string;
    let userEmail: string;

    beforeEach(async () => {
      const app = getApp();
      userEmail = 'verify-test@example.com';

      // Register user (creates verification code)
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Verify Test User',
          email: userEmail,
          password: 'Password123!',
        })
        .expect(201);

      // Get the verification code from DB (we need to hash it to find)
      const user = await prisma.user.findUnique({ where: { email: userEmail } });
      const token = await prisma.emailVerificationToken.findFirst({
        where: { userId: user!.id, usedAt: null },
      });

      // We can't reverse the hash, so we'll create a known code
      verificationCode = '654321';
      const codeHash = crypto.createHash('sha256').update(verificationCode).digest('hex');
      const expiresAt = new Date(Date.now() + 3600000);

      await prisma.emailVerificationToken.update({
        where: { id: token!.id },
        data: { code: codeHash, expiresAt },
      });
    });

    it('should verify email with valid code', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({
          email: userEmail,
          code: verificationCode,
        })
        .expect(200);

      expect(response.body).toHaveProperty('emailVerified', true);

      // Verify user is marked as verified in DB
      const user = await prisma.user.findUnique({ where: { email: userEmail } });
      expect(user?.emailVerified).toBe(true);
    });

    it('should return 200 for already verified email', async () => {
      const app = getApp();

      // First verification
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email: userEmail, code: verificationCode })
        .expect(200);

      // Second verification - should succeed
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email: userEmail, code: verificationCode })
        .expect(200);
    });

    it('should return 400 for invalid code', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email: userEmail, code: '000000' })
        .expect(400);
    });

    it('should return 400 for non-existing email', async () => {
      const app = getApp();

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ email: 'nonexistent@example.com', code: verificationCode })
        .expect(400);
    });
  });

  describe('POST /auth/resend-verification', () => {
    beforeEach(async () => {
      await createTestUser('resend@example.com', 'Password123!', 'Resend User');
      // Mark as unverified
      await prisma.user.update({
        where: { email: 'resend@example.com' },
        data: { emailVerified: false },
      });
    });

    it('should return 200 for unverified user', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email: 'resend@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify new code was created
      const user = await prisma.user.findUnique({ where: { email: 'resend@example.com' } });
      const tokens = await prisma.emailVerificationToken.findMany({
        where: { userId: user!.id },
      });
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should return 200 for already verified user', async () => {
      const app = getApp();

      await prisma.user.update({
        where: { email: 'resend@example.com' },
        data: { emailVerified: true },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email: 'resend@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('emailVerified', true);
    });

    it('should return same response for non-existing email', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /auth/verification-status', () => {
    let accessToken: string;

    beforeEach(async () => {
      const app = getApp();
      await createTestUser('status@example.com', 'Password123!', 'Status User');

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'status@example.com', password: 'Password123!' })
        .expect(200);

      accessToken = (loginResponse.body as LoginResponse).access_token;
    });

    it('should return verification status for authenticated user', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .get('/auth/verification-status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as VerificationStatusResponse;
      expect(body).toHaveProperty('email', 'status@example.com');
      expect(body).toHaveProperty('emailVerified', true);
    });

    it('should return 401 without authentication', async () => {
      const app = getApp();

      await request(app.getHttpServer()).get('/auth/verification-status').expect(401);
    });

    it('should work for unverified users (skips email verification)', async () => {
      const app = getApp();

      // Create unverified user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Unverified Status',
          email: 'unverified-status@example.com',
          password: 'Password123!',
        })
        .expect(201);

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'unverified-status@example.com',
          password: 'Password123!',
        })
        .expect(200);

      const token = (loginResponse.body as LoginResponse).access_token;

      // Should succeed even though user is unverified
      const response = await request(app.getHttpServer())
        .get('/auth/verification-status')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = response.body as VerificationStatusResponse;
      expect(body).toHaveProperty('emailVerified', false);
    });
  });
});
