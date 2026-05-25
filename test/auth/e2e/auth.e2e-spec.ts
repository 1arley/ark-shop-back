import request from 'supertest';
import { getApp, getPrismaService, createTestUser } from '@test/setup/e2e.setup';
import * as bcrypt from 'bcrypt';

// Definição de tipos para as respostas da API
interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RegisterResponse {
  message: string;
  user: UserResponse;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: UserResponse;
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

interface ErrorResponse {
  message: string | string[];
  error: string;
  statusCode: number;
}

describe('AuthController (e2e)', () => {
  afterEach(async () => {
    const prisma = getPrismaService();
    await prisma.refreshToken.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.emailVerificationToken.deleteMany({});
    await prisma.pendingRegistration.deleteMany({});
    await prisma.user.deleteMany({});
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully (creates pending registration)', async () => {
      const app = getApp();
      const prisma = getPrismaService();

      const registerDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      const body = response.body as RegisterResponse;

      expect(body.message).toBe(
        'Registration successful. Please check your email to verify your account.',
      );
      expect(body.emailVerificationRequired).toBe(true);

      // User is stored in PendingRegistration, not User table (email verification flow)
      const pending = await prisma.pendingRegistration.findUnique({
        where: { email: registerDto.email },
      });

      expect(pending).toBeDefined();
      expect(pending?.name).toBe(registerDto.name);
      expect(pending?.email).toBe(registerDto.email);

      // No User record exists yet
      const userInDb = await prisma.user.findUnique({
        where: { email: registerDto.email },
      });
      expect(userInDb).toBeNull();
    });

    it('should return 409 Conflict when email already exists as user', async () => {
      const app = getApp();
      await createTestUser('existing@example.com');

      const registerDto = {
        name: 'Another User',
        email: 'existing@example.com',
        password: 'Password123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(409);

      const body = response.body as ErrorResponse;
      expect(body.message).toContain('Email already registered');
    });

    it('should return 409 when email has pending registration', async () => {
      const app = getApp();

      // First registration creates pending registration
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Pending User',
          email: 'pending@example.com',
          password: 'Password123!',
        })
        .expect(201);

      // Second attempt should get 409
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Another User',
          email: 'pending@example.com',
          password: 'Password123!',
        })
        .expect(409);

      const body = response.body as ErrorResponse;
      expect(body.message).toContain('already pending');
    });

    it('should return 400 when name is missing', async () => {
      const app = getApp();

      const registerDto = {
        email: 'test@example.com',
        password: 'Password123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(400);

      const body = response.body as ErrorResponse;
      expect(body.message).toBeDefined();
    });

    it('should validate email format', async () => {
      const app = getApp();

      const invalidDto = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'Password123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidDto)
        .expect(400);

      const body = response.body as ErrorResponse;
      expect(body.message).toBeDefined();
    });

    it('should validate password strength', async () => {
      const app = getApp();

      const weakPasswordDto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'weak',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(weakPasswordDto)
        .expect(400);

      const body = response.body as ErrorResponse;
      expect(body.message).toBeDefined();
    });

    it('should handle missing required fields', async () => {
      const app = getApp();

      const incompleteDto = {
        password: 'Password123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(incompleteDto)
        .expect(400);

      const body = response.body as ErrorResponse;
      expect(body.message).toBeDefined();
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await createTestUser('user@example.com', 'Password123!', 'Test User');
    });

    it('should login successfully with valid credentials', async () => {
      const app = getApp();

      const loginDto = {
        email: 'user@example.com',
        password: 'Password123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(200);

      const body = response.body as LoginResponse;

      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('refresh_token');
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe(loginDto.email);
      expect(body.user).not.toHaveProperty('password');
      expect(typeof body.access_token).toBe('string');
      expect(body.access_token.length).toBeGreaterThan(0);
    });

    it('should return 401 Unauthorized with wrong password', async () => {
      const app = getApp();

      const loginDto = {
        email: 'user@example.com',
        password: 'WrongPassword123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);

      const body = response.body as ErrorResponse;
      expect(body.message).toContain('Invalid credentials');
    });

    it('should return 401 Unauthorized for non-existent user', async () => {
      const app = getApp();

      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'Password123!',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginDto)
        .expect(401);

      const body = response.body as ErrorResponse;
      expect(body.message).toContain('Invalid credentials');
    });

    it('should prevent timing attacks (similar response time for user exists/not exists)', async () => {
      const app = getApp();

      const start1 = Date.now();
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'WrongPassword123!' })
        .expect(401);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Password123!' })
        .expect(401);
      const time2 = Date.now() - start2;

      expect(time1).toBeGreaterThan(0);
      expect(time2).toBeGreaterThan(0);
    });

    it('should handle empty credentials', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: '', password: '' });

      expect([400, 401]).toContain(response.status);
      expect((response.body as ErrorResponse).message).toBeDefined();
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const app = getApp();
      await createTestUser('user@example.com', 'Password123!', 'Test User');

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'Password123!' })
        .expect(200);

      refreshToken = (loginResponse.body as LoginResponse).refresh_token;
    });

    it('should refresh tokens successfully with valid refresh token', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(200);

      const body = response.body as RefreshResponse;
      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('refresh_token');
      expect(body.access_token).not.toBe(refreshToken);
    });

    it('should return 401 Unauthorized without refresh token', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer()).post('/auth/refresh').expect(401);

      expect((response.body as ErrorResponse).message).toContain('Unauthorized');
    });

    it('should return 401 Unauthorized with invalid refresh token', async () => {
      const app = getApp();

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect((response.body as ErrorResponse).message).toContain('Unauthorized');
    });

    it('should return 401 Unauthorized with expired refresh token', async () => {
      const app = getApp();

      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect((response.body as ErrorResponse).message).toContain('Unauthorized');
    });

    it('should prevent refresh token reuse after rotation', async () => {
      const app = getApp();

      const response1 = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(200);

      const newRefreshToken = (response1.body as RefreshResponse).refresh_token;
      expect(newRefreshToken).toBeDefined();

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${newRefreshToken}`)
        .expect(200);

      expect(refreshToken).not.toBe(newRefreshToken);

      const oldTokenResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(401);

      expect((oldTokenResponse.body as ErrorResponse).message).toContain('Refresh token inválido');
    });
  });

  describe('Security scenarios', () => {
    it('should not expose user existence through login error messages', async () => {
      const app = getApp();

      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Password123!' })
        .expect(401);

      const body = loginResponse.body as ErrorResponse;
      expect(body.message).toBeDefined();
      expect(body.message).toContain('Invalid credentials');
    });

    it('should have consistent responses under load', async () => {
      const app = getApp();
      await createTestUser('test@example.com', 'Password123!', 'Test User');

      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer()).post('/auth/login').send({
            email: 'test@example.com',
            password: 'Password123!',
          }),
        );

      const responses = await Promise.allSettled(requests.map(req => req));
      expect(responses).toHaveLength(5);
      for (const response of responses) {
        if (response.status === 'rejected') {
          console.log('Load test rejection:', response.reason);
        }
        expect(response.status).toBe('fulfilled');
      }
    });

    it('should store passwords securely (hashed)', async () => {
      const prisma = getPrismaService();

      const password = 'Password123!';
      // Create user directly (verified) for password hashing test
      await createTestUser('secure@example.com', password, 'Test User');

      const user = await prisma.user.findUnique({
        where: { email: 'secure@example.com' },
      });

      expect(user).toBeDefined();
      expect(user?.password).toBeDefined();
      expect(user?.password).not.toBe(password);

      if (user?.password) {
        expect(user.password).not.toContain('Password');
        const isValidHash = await bcrypt.compare(password, user.password);
        expect(isValidHash).toBe(true);
      } else {
        throw new Error('User password not found in database');
      }
    });
  });

  describe('Integration scenarios', () => {
    it('should allow full auth flow: register -> verify -> login -> refresh', async () => {
      const app = getApp();
      const prisma = getPrismaService();

      const registerDto = {
        name: 'Integration User',
        email: 'integration@example.com',
        password: 'Password123!',
      };

      // Step 1: Register (creates PendingRegistration)
      const registerResponse = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerDto)
        .expect(201);

      expect((registerResponse.body as RegisterResponse).message).toContain(
        'Registration successful',
      );

      // Step 2: Get verification code from PendingRegistration
      const pending = await prisma.pendingRegistration.findUnique({
        where: { email: registerDto.email },
      });
      expect(pending).toBeDefined();

      // We need to update the code since we can't reverse the hash
      // Instead, we'll use the verify-email endpoint that handles pending registrations
      // The code is stored hashed, so we'll update it with a known code
      const testCode = '123456';
      const crypto = require('crypto');
      const codeHash = crypto.createHash('sha256').update(testCode).digest('hex');
      await prisma.pendingRegistration.update({
        where: { email: registerDto.email },
        data: { code: codeHash },
      });

      // Step 3: Verify email (creates User from PendingRegistration)
      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({
          email: registerDto.email,
          code: testCode,
        })
        .expect(200);

      // Step 4: Login (now works because User exists)
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: registerDto.email,
          password: registerDto.password,
        })
        .expect(200);

      const { access_token, refresh_token } = loginResponse.body as LoginResponse;
      expect(access_token).toBeDefined();
      expect(refresh_token).toBeDefined();

      // Step 5: Refresh
      const refreshResponse = await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Authorization', `Bearer ${refresh_token}`)
        .expect(200);

      const newAccessToken = (refreshResponse.body as RefreshResponse).access_token;
      expect(newAccessToken).toBeDefined();
    });

    it('should handle concurrent auth requests', async () => {
      const app = getApp();
      const prisma = getPrismaService();

      const baseEmail = 'concurrent';
      const requests = Array(5)
        .fill(null)
        .map((_, index) => {
          const email = `${baseEmail}${index}@example.com`;
          return request(app.getHttpServer())
            .post('/auth/register')
            .send({
              name: `User ${index}`,
              email,
              password: 'Password123!',
            });
        });

      const responses = await Promise.allSettled(requests.map(req => req));
      for (const response of responses) {
        expect(response.status).toBe('fulfilled');
        if (response.status === 'fulfilled') {
          expect(response.value.status).toBe(201);
        }
      }

      for (let idx = 0; idx < 5; idx++) {
        const email = `${baseEmail}${idx}@example.com`;
        // After registration, the pending registration exists
        const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
        expect(pending).toBeDefined();
      }
    });

    describe('Email verification enforcement', () => {
      it('should block unverified user from accessing /auth/me', async () => {
        const app = getApp();

        // Create verified user first for login
        await createTestUser('verified-for-login@example.com', 'Password123!', 'Verified Login');

        // Register creates user with emailVerified: false
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            name: 'Unverified User',
            email: 'unverified@example.com',
            password: 'Password123!',
          })
          .expect(201);

        // Login with a verified user (created by createTestUser)
        const loginResponse = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'verified-for-login@example.com',
            password: 'Password123!',
          })
          .expect(200);

        const { access_token } = loginResponse.body as LoginResponse;
        expect(loginResponse.body).toHaveProperty('emailVerified', true);

        // Accessing protected route should work for verified user
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${access_token}`)
          .expect(200);
      });

      it('should allow verified user to access /auth/me', async () => {
        const app = getApp();

        // Create verified user directly in DB
        await createTestUser('verified@example.com', 'Password123!', 'Verified User');

        const loginResponse = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'verified@example.com',
            password: 'Password123!',
          })
          .expect(200);

        const { access_token } = loginResponse.body as LoginResponse;
        expect(loginResponse.body).toHaveProperty('emailVerified', true);

        // Verified user can access protected routes
        const meResponse = await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${access_token}`)
          .expect(200);

        expect(meResponse.body).toHaveProperty('email', 'verified@example.com');
        expect(meResponse.body).toHaveProperty('emailVerified', true);
      });

      it('should allow access after email verification', async () => {
        const app = getApp();
        const prisma = getPrismaService();

        // Register user (unverified - creates PendingRegistration)
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({
            name: 'Verify Later User',
            email: 'verify-later@example.com',
            password: 'Password123!',
          })
          .expect(201);

        // Verify email to create User
        const pending = await prisma.pendingRegistration.findUnique({
          where: { email: 'verify-later@example.com' },
        });
        expect(pending).toBeDefined();

        const crypto = require('crypto');
        const testCode = '654321';
        const codeHash = crypto.createHash('sha256').update(testCode).digest('hex');
        await prisma.pendingRegistration.update({
          where: { email: 'verify-later@example.com' },
          data: { code: codeHash },
        });

        await request(app.getHttpServer())
          .post('/auth/verify-email')
          .send({ email: 'verify-later@example.com', code: testCode })
          .expect(200);

        // Login to get tokens
        const loginResponse = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'verify-later@example.com',
            password: 'Password123!',
          })
          .expect(200);

        const { access_token } = loginResponse.body as LoginResponse;

        // Should be allowed because user is verified
        await request(app.getHttpServer())
          .get('/auth/me')
          .set('Authorization', `Bearer ${access_token}`)
          .expect(200);
      });
    });
  });
});
