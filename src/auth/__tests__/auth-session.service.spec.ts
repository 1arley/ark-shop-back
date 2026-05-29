import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthSessionService } from '../auth-session.service';
import { AuthTokenService } from '../auth-token.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('AuthSessionService', () => {
  let service: AuthSessionService;

  let _prisma: PrismaService;

  let _authTokenService: AuthTokenService;

  const mockPrismaService = {
    user: { findUnique: jest.fn() },
    refreshToken: { findFirst: jest.fn(), deleteMany: jest.fn() },
  };

  const mockAuthTokenService = {
    generateTokenPair: jest.fn(),
    createRefreshToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthSessionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuthTokenService, useValue: mockAuthTokenService },
      ],
    }).compile();

    service = module.get<AuthSessionService>(AuthSessionService);
    _prisma = module.get<PrismaService>(PrismaService);
    _authTokenService = module.get<AuthTokenService>(AuthTokenService);

    jest.clearAllMocks();
  });

  describe('refreshTokens', () => {
    it('should scope refresh token lookup to the specific userId (security)', async () => {
      const userId = 'user-id-1';
      const oldRefreshToken = 'some-refresh-token';
      const crypto = require('crypto');
      const tokenHash = crypto.createHash('sha256').update(oldRefreshToken).digest('hex');

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'test@test.com',
        role: 'USER',
        emailVerified: true,
        name: 'Test User',
      });

      // Simulate finding a token that belongs to a DIFFERENT user (security leak)
      mockPrismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'token-id-1',
        token: tokenHash,
        userId: 'different-user-id', // Token belongs to another user!
        rememberMe: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
      mockAuthTokenService.generateTokenPair.mockResolvedValue({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
      });

      // The findFirst should include userId to prevent cross-user token lookup.
      // If it doesn't, the test proves the vulnerability exists.
      await expect(service.refreshTokens(userId, oldRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );

      // Verify the findFirst call included userId in the WHERE clause
      expect(mockPrismaService.refreshToken.findFirst).toHaveBeenCalledWith({
        where: {
          token: tokenHash,
          userId, // <-- This must be present for security!
        },
      });
    });
  });
});
