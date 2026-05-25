import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '@/auth/auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EmailService } from '@/modules/email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;
  let emailService: EmailService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    pendingRegistration: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    emailVerificationToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockEmailService = {
    sendEmailVerification: jest.fn().mockResolvedValue(true),
    sendPasswordReset: jest.fn().mockResolvedValue(true),
    sendPasswordResetWithCode: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn(), getOrThrow: jest.fn() } },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    emailService = module.get<EmailService>(EmailService);
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
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.pendingRegistration.findUnique.mockResolvedValue(null);
      mockPrismaService.pendingRegistration.create.mockResolvedValue({ id: '1' });

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('emailVerificationRequired', true);
      expect(result.message).toContain('Registration successful');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(prisma.pendingRegistration.create).toHaveBeenCalled();
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
        role: 'USER',
        emailVerified: true,
        createdAt,
        updatedAt,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.validateUser('1');

      expect(result).not.toHaveProperty('password');
      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: expect.objectContaining({
          id: true,
          email: true,
          role: true,
        }),
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
      jest.spyOn(configService, 'get').mockReturnValue('7d');
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const storedToken = {
        id: 'rt1',
        token: 'hashed-token',
        userId: '1',
        rememberMe: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(storedToken);
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

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

    it('deve preservar rememberMe quando o refresh token armazenado tem rememberMe true', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        role: 'USER',
        emailVerified: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'rt1',
        token: 'hashed-token',
        userId: '1',
        rememberMe: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('fake-jwt-token');
      jest.spyOn(configService, 'get').mockReturnValue('7d');
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.refreshTokens('1', 'old-refresh-token');

      expect(result).toHaveProperty('remember_me', true);
    });

    it('deve lancar UnauthorizedException se refresh token nao existir', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        role: 'USER',
        emailVerified: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refreshTokens('1', 'old-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lancar UnauthorizedException se deleteMany retornar count 0 (token ja usado)', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        role: 'USER',
        emailVerified: true,
      };

      const storedToken = {
        id: 'rt1',
        token: 'hashed-token',
        userId: '1',
        rememberMe: false,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(storedToken);
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('fake-jwt-token');
      jest.spyOn(configService, 'get').mockReturnValue('7d');
      // Simulate concurrent access: token was already deleted by another request
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.refreshTokens('1', 'old-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('deve criar token de redefinicao e retornar mensagem de sucesso para usuario existente', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: false,
      };
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.passwordResetToken.create.mockResolvedValue({ id: 'prt1' });
      jest.spyOn(configService, 'get').mockReturnValue('1');

      const result = await service.forgotPassword('test@example.com');

      expect(result).toEqual({
        message: 'Se o email existir, um link de redefinicao sera enviado.',
      });
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
      expect(emailService.sendPasswordReset).toHaveBeenCalled();
    });

    it('deve retornar mesma mensagem mesmo quando usuario nao existe', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@example.com');

      expect(result).toEqual({
        message: 'Se o email existir, um link de redefinicao sera enviado.',
      });
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('deve retornar mensagem mesmo se envio de email falhar (nao-bloqueante)', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: false,
      };
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.passwordResetToken.create.mockResolvedValue({ id: 'prt1' });
      mockEmailService.sendPasswordReset.mockRejectedValue(new Error('SMTP error'));
      jest.spyOn(configService, 'get').mockReturnValue('1');

      const result = await service.forgotPassword('test@example.com');

      expect(result).toEqual({
        message: 'Se o email existir, um link de redefinicao sera enviado.',
      });
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    });
  });

  describe('forgotPasswordWithCode', () => {
    it('deve criar codigo OTP e retornar mensagem de sucesso para usuario existente', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: false,
      };
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.passwordResetToken.create.mockResolvedValue({ id: 'prt1' });

      const result = await service.forgotPasswordWithCode('test@example.com');

      expect(result).toEqual({
        message: 'Se o email existir, um codigo de redefinicao sera enviado.',
      });
      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalled();
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
      expect(emailService.sendPasswordResetWithCode).toHaveBeenCalled();
    });

    it('deve retornar mesma mensagem mesmo quando usuario nao existe', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPasswordWithCode('nonexistent@example.com');

      expect(result).toEqual({
        message: 'Se o email existir, um codigo de redefinicao sera enviado.',
      });
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    const resetDto = {
      token: 'valid-reset-token',
      email: 'test@example.com',
      password: 'NewPassword123!',
    };

    it('deve redefinir senha com sucesso usando token valido', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'old-hashed',
        role: 'USER',
        emailVerified: false,
      };
      const resetToken = {
        id: 'prt1',
        token: crypto.createHash('sha256').update(resetDto.token).digest('hex'),
        userId: '1',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.passwordResetToken.findFirst.mockResolvedValue(resetToken);
      mockPrismaService.$transaction.mockResolvedValue([{}, {}]);
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      jest.spyOn(configService, 'get').mockReturnValue('12');

      const result = await service.resetPassword(resetDto);

      expect(result).toEqual({ message: 'Senha redefinida com sucesso.' });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: '1' } });
    });

    it('deve lancar BadRequestException quando usuario nao existe', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(BadRequestException);
      await expect(service.resetPassword(resetDto)).rejects.toThrow('Token invalido ou expirado.');
    });

    it('deve lancar BadRequestException quando token e invalido', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: false,
      };
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(BadRequestException);
      await expect(service.resetPassword(resetDto)).rejects.toThrow('Token invalido ou expirado.');
    });

    it('deve lancar BadRequestException quando token esta expirado', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: false,
      };
      // Prisma's `expiresAt: { gt: new Date() }` filter would exclude expired tokens,
      // so findFirst returns null for expired tokens
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(BadRequestException);
      await expect(service.resetPassword(resetDto)).rejects.toThrow('Token invalido ou expirado.');
    });

    it('deve lancar BadRequestException quando token ja foi usado', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: false,
      };
      // Prisma's `usedAt: null` filter would exclude used tokens,
      // so findFirst returns null for used tokens
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword(resetDto)).rejects.toThrow(BadRequestException);
    });

    it('deve revogar todos os refresh tokens apos redefinicao de senha', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'old-hashed',
        role: 'USER',
        emailVerified: false,
      };
      const resetToken = {
        id: 'prt1',
        token: crypto.createHash('sha256').update(resetDto.token).digest('hex'),
        userId: '1',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.passwordResetToken.findFirst.mockResolvedValue(resetToken);
      mockPrismaService.$transaction.mockResolvedValue([{}, {}]);
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 2 });
      jest.spyOn(configService, 'get').mockReturnValue('12');

      await service.resetPassword(resetDto);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: '1' } });
    });
  });

  describe('resetPasswordWithCode', () => {
    const resetCodeDto = {
      code: '123456',
      email: 'test@example.com',
      password: 'NewPassword123!',
    };

    it('deve redefinir senha com sucesso usando codigo valido', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'old-hashed',
        role: 'USER',
        emailVerified: false,
      };
      const resetToken = {
        id: 'prt1',
        token: crypto.createHash('sha256').update(resetCodeDto.code).digest('hex'),
        userId: '1',
        expiresAt: new Date(Date.now() + 600000),
        usedAt: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.passwordResetToken.findFirst.mockResolvedValue(resetToken);
      mockPrismaService.$transaction.mockResolvedValue([{}, {}]);
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      jest.spyOn(configService, 'get').mockReturnValue('12');

      const result = await service.resetPasswordWithCode(resetCodeDto);

      expect(result).toEqual({ message: 'Senha redefinida com sucesso.' });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: '1' } });
    });

    it('deve lancar BadRequestException quando usuario nao existe', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPasswordWithCode(resetCodeDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resetPasswordWithCode(resetCodeDto)).rejects.toThrow(
        'Codigo invalido ou expirado.',
      );
    });

    it('deve lancar BadRequestException quando codigo e invalido', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: false,
      };
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(service.resetPasswordWithCode(resetCodeDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.resetPasswordWithCode(resetCodeDto)).rejects.toThrow(
        'Codigo invalido ou expirado.',
      );
    });

    it('deve lancar BadRequestException quando codigo esta expirado', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: false,
      };
      // Prisma's `expiresAt: { gt: new Date() }` filter would exclude expired tokens
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(service.resetPasswordWithCode(resetCodeDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyEmail', () => {
    const verifyDto = {
      email: 'test@example.com',
      code: '123456',
    };

    it('deve verificar email com sucesso usando codigo valido', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: false,
      };
      const pendingRegistration = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        code: crypto.createHash('sha256').update(verifyDto.code).digest('hex'),
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.pendingRegistration.findUnique.mockResolvedValue(pendingRegistration);
      mockPrismaService.user.create.mockResolvedValue({ ...user, emailVerified: true });
      mockPrismaService.pendingRegistration.delete.mockResolvedValue(undefined);
      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          user: { create: mockPrismaService.user.create },
          pendingRegistration: { delete: mockPrismaService.pendingRegistration.delete },
        };
        return await callback(mockTx);
      });

      const result = await service.verifyEmail(verifyDto);

      expect(result).toEqual({ message: 'Email verificado com sucesso.', emailVerified: true });
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.pendingRegistration.delete).toHaveBeenCalled();
    });

    it('deve lancar BadRequestException quando usuario nao existe', async () => {
      mockPrismaService.pendingRegistration.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail(verifyDto)).rejects.toThrow(BadRequestException);
      await expect(service.verifyEmail(verifyDto)).rejects.toThrow(
        'Codigo de verificacao invalido.',
      );
    });

    it('deve retornar mensagem de ja verificado quando email ja esta verificado', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: true,
      };
      mockPrismaService.pendingRegistration.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.verifyEmail(verifyDto);

      expect(result).toEqual({ message: 'Email ja verificado.', emailVerified: true });
    });

    it('deve lancar BadRequestException quando codigo e invalido', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: false,
      };
      const pendingWithWrongCode = {
        id: '1',
        email: 'test@example.com',
        name: 'Test',
        code: 'wrong-hash',
        expiresAt: new Date(Date.now() + 3600000),
      };
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.pendingRegistration.findUnique.mockResolvedValue(pendingWithWrongCode);

      await expect(service.verifyEmail(verifyDto)).rejects.toThrow(BadRequestException);
      await expect(service.verifyEmail(verifyDto)).rejects.toThrow('invalido');
    });

    it('deve lancar BadRequestException quando codigo esta expirado', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: false,
      };
      const expiredPending = {
        id: '1',
        email: 'test@example.com',
        name: 'Test',
        code: crypto.createHash('sha256').update(verifyDto.code).digest('hex'), // Correct code
        expiresAt: new Date(Date.now() - 1000), // Expired
      };
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.pendingRegistration.findUnique.mockResolvedValue(expiredPending);

      await expect(service.verifyEmail(verifyDto)).rejects.toThrow(BadRequestException);
      await expect(service.verifyEmail(verifyDto)).rejects.toThrow('expirado');
    });
  });

  describe('resendVerificationEmail', () => {
    it('deve gerar novo codigo e enviar email para usuario nao verificado', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: false,
      };
      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.emailVerificationToken.deleteMany.mockResolvedValue({ count: 1 });
      mockPrismaService.emailVerificationToken.create.mockResolvedValue({ id: 'evt1' });

      const result = await service.resendVerificationEmail('test@example.com');

      expect(result).toEqual({ message: 'Se o email existir, um novo codigo sera enviado.' });
      expect(prisma.pendingRegistration.update).toHaveBeenCalled();
      expect(emailService.sendEmailVerification).toHaveBeenCalled();
    });

    it('deve retornar mensagem quando usuario nao existe', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.resendVerificationEmail('nonexistent@example.com');

      expect(result).toEqual({ message: 'Se o email existir, um novo codigo sera enviado.' });
      expect(prisma.emailVerificationToken.create).not.toHaveBeenCalled();
    });

    it('deve retornar mensagem de ja verificado quando email ja esta verificado', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        password: 'hashed',
        role: 'USER',
        emailVerified: true,
      };
      mockPrismaService.pendingRegistration.findUnique.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.resendVerificationEmail('test@example.com');

      expect(result).toEqual({ message: 'Email ja esta verificado.', emailVerified: true });
    });
  });

  describe('revokeRefreshToken', () => {
    it('deve revogar um refresh token existente', async () => {
      const storedToken = {
        id: 'rt1',
        token: crypto.createHash('sha256').update('some-token').digest('hex'),
        userId: '1',
        expiresAt: new Date(Date.now() + 86400000),
      };
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(storedToken);

      await service.revokeRefreshToken('some-token');

      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt1' } });
    });

    it('deve lancar NotFoundException quando token nao existe', async () => {
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.revokeRefreshToken('invalid-token')).rejects.toThrow(NotFoundException);
      await expect(service.revokeRefreshToken('invalid-token')).rejects.toThrow(
        'Refresh token não encontrado.',
      );
    });
  });

  describe('getTokens', () => {
    it('deve gerar tokens com rememberMe (30d) quando flag e true', async () => {
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('fake-token');
      jest.spyOn(configService, 'getOrThrow').mockReturnValue('secret');
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_EXPIRES_IN') return '15m';
        return undefined;
      });

      const result = await (service as any).getTokens('1', 'USER', {
        rememberMe: true,
      });

      expect(result).toHaveProperty('remember_me', true);
      expect(result).toHaveProperty('access_token', 'fake-token');
      expect(result).toHaveProperty('refresh_token', 'fake-token');
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ sub: '1', role: 'USER', jti: expect.any(String) }),
        expect.objectContaining({ secret: 'secret', expiresIn: '15m' }),
      );
      expect(jwtService.signAsync).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ sub: '1', role: 'USER' }),
        {
          secret: 'secret',
          expiresIn: '30d',
        },
      );
    });

    it('deve gerar tokens sem rememberMe (7d) quando flag e false', async () => {
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('fake-token');
      jest.spyOn(configService, 'getOrThrow').mockReturnValue('secret');
      jest.spyOn(configService, 'get').mockReturnValue('7d');

      const result = await (service as any).getTokens('1', 'USER', {
        rememberMe: false,
      });

      expect(result).toHaveProperty('remember_me', false);
    });

    it('deve usar valor padrao 7d quando JWT_REFRESH_EXPIRES_IN nao esta configurado', async () => {
      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('fake-token');
      jest.spyOn(configService, 'getOrThrow').mockReturnValue('secret');
      jest.spyOn(configService, 'get').mockReturnValue(undefined);

      const result = await (service as any).getTokens('1', 'USER', {});

      expect(result).toHaveProperty('remember_me', false);
    });
  });

  describe('parseExpiresInToSeconds', () => {
    it('deve converter "30m" para 1800 segundos', () => {
      const result = (service as any).parseExpiresInToSeconds('30m');
      expect(result).toBe(1800);
    });

    it('deve converter "7d" para 604800 segundos', () => {
      const result = (service as any).parseExpiresInToSeconds('7d');
      expect(result).toBe(604800);
    });

    it('deve converter "1h" para 3600 segundos', () => {
      const result = (service as any).parseExpiresInToSeconds('1h');
      expect(result).toBe(3600);
    });

    it('deve converter "30d" para 2592000 segundos', () => {
      const result = (service as any).parseExpiresInToSeconds('30d');
      expect(result).toBe(2592000);
    });

    it('deve usar padrao de 7 dias para formato invalido', () => {
      const result = (service as any).parseExpiresInToSeconds('invalid');
      expect(result).toBe(604800);
    });

    it('deve converter "60s" para 60 segundos', () => {
      const result = (service as any).parseExpiresInToSeconds('60s');
      expect(result).toBe(60);
    });
  });

  describe('createRefreshToken', () => {
    it('deve criar refresh token com rememberMe (30d)', async () => {
      mockPrismaService.refreshToken.create.mockResolvedValue({ id: 'rt1' });

      await (service as any).createRefreshToken('1', 'some-token', { rememberMe: true });

      expect(prisma.refreshToken.create).toHaveBeenCalled();
      const createCall = mockPrismaService.refreshToken.create.mock.calls[0];
      expect(createCall[0].data.expiresAt).toBeInstanceOf(Date);
      expect(createCall[0].data.userId).toBe('1');
      expect(createCall[0].data.rememberMe).toBe(true);
    });

    it('deve criar refresh token sem rememberMe (7d por padrao)', async () => {
      mockPrismaService.refreshToken.create.mockResolvedValue({ id: 'rt1' });
      jest.spyOn(configService, 'get').mockReturnValue('7d');

      await (service as any).createRefreshToken('1', 'some-token', { rememberMe: false });

      expect(prisma.refreshToken.create).toHaveBeenCalled();
      const createCall = mockPrismaService.refreshToken.create.mock.calls[0];
      expect(createCall[0].data.rememberMe).toBe(false);
    });
  });
});
