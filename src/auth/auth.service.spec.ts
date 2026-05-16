import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@/auth/auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { EmailService } from '@/modules/email/email.service';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    emailVerificationToken: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn(), getOrThrow: jest.fn() } },
        {
          provide: EmailService,
          useValue: {
            sendEmailVerification: jest.fn().mockResolvedValue(true),
            sendPasswordReset: jest.fn().mockResolvedValue(true),
            sendPasswordResetWithCode: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('deve registrar um novo usuário com sucesso e requerer verificação de email', async () => {
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);
      const createdAt = new Date('2025-01-01T00:00:00Z');
      const updatedAt = new Date('2025-01-01T00:00:00Z');
      const createdUser = {
        id: '1',
        name: registerDto.name,
        email: registerDto.email,
        password: hashedPassword,
        role: 'USER',
        emailVerified: false,
        createdAt,
        updatedAt,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(createdUser);
      mockPrismaService.emailVerificationToken.create.mockResolvedValue({ id: '1' });

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('emailVerificationRequired', true);
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(registerDto.email);
      expect(result.user).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('access_token');
      expect(result.user).not.toHaveProperty('refresh_token');
      expect(result.user.createdAt).toEqual(createdAt);
      expect(result.user.updatedAt).toEqual(updatedAt);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.emailVerificationToken.create).toHaveBeenCalled();
    });

    it('deve lançar ConflictException se email já existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('deve fazer login com credenciais válidas e retornar tokens com flag emailVerified', async () => {
      const hashedPassword = await bcrypt.hash(loginDto.password, 10);
      const user = {
        id: '1',
        name: 'Test User',
        email: loginDto.email,
        password: hashedPassword,
        role: 'USER',
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('fake-jwt-token');
      jest.spyOn(configService, 'get').mockReturnValue('fake-secret');
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('user');
      expect(result.user).not.toHaveProperty('password');
      expect(result).toHaveProperty('access_token', 'fake-jwt-token');
      expect(result).toHaveProperty('refresh_token', 'fake-jwt-token');
      expect(result).toHaveProperty('emailVerified', true);
    });

    it('deve retornar emailVerified: false quando usuario nao verificou email', async () => {
      const hashedPassword = await bcrypt.hash(loginDto.password, 10);
      const user = {
        id: '1',
        name: 'Test User',
        email: loginDto.email,
        password: hashedPassword,
        role: 'USER',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('fake-jwt-token');
      jest.spyOn(configService, 'get').mockReturnValue('fake-secret');
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('emailVerified', false);
    });

    it('deve lançar UnauthorizedException se usuário não existe', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException se senha estiver incorreta', async () => {
      const user = {
        id: '1',
        email: loginDto.email,
        password: await bcrypt.hash('DifferentPassword', 10),
        role: 'USER',
        emailVerified: false,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateUser', () => {
    it('deve retornar usuário sem senha se ID for válido', async () => {
      const createdAt = new Date();
      const updatedAt = new Date();
      const user = {
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'USER',
        emailVerified: true,
        createdAt,
        updatedAt,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.validateUser('1');

      expect(result).not.toHaveProperty('password');
      expect(result).toEqual({
        id: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        emailVerified: true,
        createdAt,
        updatedAt,
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('deve lançar UnauthorizedException se usuário não existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.validateUser('999')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshTokens', () => {
    it('deve gerar novos tokens para um userId válido', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        role: 'USER',
        emailVerified: true,
      };

      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('fake-jwt-token');
      jest.spyOn(configService, 'get').mockReturnValue('fake-secret');
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      // Mock findFirst to return null since we're testing the happy path
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(null);

      const result = await service.refreshTokens('1', 'old-refresh-token');

      expect(result).toHaveProperty('access_token', 'fake-jwt-token');
      expect(result).toHaveProperty('refresh_token', 'fake-jwt-token');
    });

    it('deve lançar UnauthorizedException se userId não existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      await expect(service.refreshTokens('999', 'old-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
