import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '@/user/user.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  const publicUser = (overrides: Record<string, unknown> = {}) => ({
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    avatarUrl: null,
    role: Role.USER,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    order: {
      count: jest.fn(),
    },
    payment: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123!',
      role: Role.USER,
    };

    it('should create a new user successfully', async () => {
      const createdUser = publicUser({
        name: createUserDto.name,
        email: createUserDto.email,
        role: createUserDto.role,
      });

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.create(createUserDto);

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(createUserDto.email);
      expect(result.name).toBe(createUserDto.name);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: createUserDto.email } }),
      );
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ select: expect.any(Object) }),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: '1',
        email: createUserDto.email,
      });

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('should use default USER role when not specified', async () => {
      const createDtoWithoutRole = {
        name: createUserDto.name,
        email: createUserDto.email,
        password: createUserDto.password,
      };
      const createdUser = publicUser({
        name: createDtoWithoutRole.name,
        email: createDtoWithoutRole.email,
        role: Role.USER,
      });

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.create(createDtoWithoutRole);

      expect(result.role).toBe(Role.USER);
    });
  });

  describe('findById', () => {
    it('should return user by ID without password', async () => {
      const user = publicUser();

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.findById('1');

      expect(result).not.toHaveProperty('password');
      expect(result.id).toBe('1');
      expect(result.email).toBe('test@example.com');
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: '1' }, select: expect.any(Object) }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findById('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated users without passwords', async () => {
      const users = [
        publicUser({ id: '1', name: 'User 1', email: 'user1@example.com' }),
        publicUser({ id: '2', name: 'User 2', email: 'user2@example.com', role: Role.ADMIN }),
      ];

      mockPrismaService.$transaction.mockResolvedValue([users, 2]);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).not.toHaveProperty('password');
      expect(result.data[1]).not.toHaveProperty('password');
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should handle empty result set', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });

    it('should calculate pagination correctly', async () => {
      const users = Array(15)
        .fill(null)
        .map((_, i) =>
          publicUser({
            id: `${i + 1}`,
            name: `User ${i + 1}`,
            email: `user${i + 1}@example.com`,
          }),
        );

      mockPrismaService.$transaction.mockResolvedValue([users.slice(0, 10), 25]);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(10);
      expect(result.meta.total).toBe(25);
      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('findOne', () => {
    it('should return user by ID without password', async () => {
      const user = publicUser();

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.findOne('1');

      expect(result).not.toHaveProperty('password');
      expect(result.id).toBe('1');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return user by email without password', async () => {
      const user = publicUser();

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.findByEmail('test@example.com');

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('test@example.com');
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'test@example.com' } }),
      );
    });

    it('should throw NotFoundException if user not found by email', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findByEmail('notfound@example.com')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Novos testes para métodos adicionados ──────────────────────

  describe('updateProfile', () => {
    const updateProfileDto = {
      name: 'Updated Name',
      email: 'updated@example.com',
      avatarUrl: 'https://example.com/avatar.jpg',
    };

    it('deve atualizar o perfil com sucesso', async () => {
      const existingUser = { id: 'user-1', email: 'old@example.com', role: Role.USER };
      const updatedUser = publicUser({
        id: 'user-1',
        name: updateProfileDto.name,
        email: updateProfileDto.email,
        avatarUrl: updateProfileDto.avatarUrl,
      });

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(existingUser)
        .mockResolvedValueOnce(null);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-1', updateProfileDto);

      expect(result).not.toHaveProperty('password');
      expect(result.name).toBe(updateProfileDto.name);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          select: expect.any(Object),
        }),
      );
    });

    it('deve lançar NotFoundException se usuário não existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.updateProfile('user-999', { name: 'New Name' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException se email já estiver em uso por outro usuário', async () => {
      const existingUser = {
        id: 'user-1',
        name: 'Test',
        email: 'old@example.com',
        password: 'hashed',
        role: Role.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(existingUser) // findUnique para verificar existência
        .mockResolvedValueOnce({ id: 'user-2', email: 'new@example.com' }); // email já existe

      await expect(service.updateProfile('user-1', { email: 'new@example.com' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('deve permitir atualização parcial (apenas nome)', async () => {
      const existingUser = { id: 'user-1', email: 'old@example.com', role: Role.USER };
      const updatedUser = publicUser({ id: 'user-1', name: 'New Name', email: 'old@example.com' });

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: {
            name: 'New Name',
            email: undefined,
            avatarUrl: undefined,
          },
        }),
      );
    });

    it('não deve verificar conflito de email se email não for alterado', async () => {
      const existingUser = {
        id: 'user-1',
        name: 'Test',
        email: 'same@example.com',
        password: 'hashed',
        role: Role.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedUser = {
        ...existingUser,
        name: 'New Name',
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-1', {
        name: 'New Name',
        email: 'same@example.com',
      });

      expect(result.name).toBe('New Name');
      // Não deve chamar findUnique para verificar email (pois é o mesmo)
      expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('adminUpdateUser', () => {
    const adminUpdateDto = {
      name: 'Admin Updated Name',
      email: 'admin-updated@example.com',
      role: Role.ADMIN,
      avatarUrl: 'https://example.com/avatar.jpg',
    };

    it('deve atualizar usuário com sucesso (SUPERADMIN)', async () => {
      const targetUser = { id: 'user-1', email: 'old@example.com', role: Role.USER };
      const updatedUser = publicUser({
        id: 'user-1',
        name: adminUpdateDto.name,
        email: adminUpdateDto.email,
        role: adminUpdateDto.role,
        avatarUrl: adminUpdateDto.avatarUrl,
      });

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(targetUser)
        .mockResolvedValueOnce(null);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.adminUpdateUser(
        'user-1',
        adminUpdateDto,
        'superadmin-1',
        'SUPERADMIN',
      );

      expect(result).not.toHaveProperty('password');
      expect(result.name).toBe(adminUpdateDto.name);
      expect(result.role).toBe(adminUpdateDto.role);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' }, select: expect.any(Object) }),
      );
    });

    it('deve lançar ForbiddenException se ADMIN tentar alterar cargo', async () => {
      const targetUser = {
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        password: 'hashed',
        role: Role.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);

      await expect(
        service.adminUpdateUser('user-1', { role: Role.ADMIN }, 'admin-1', 'ADMIN'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('deve lançar ForbiddenException se ADMIN tentar modificar SUPERADMIN', async () => {
      const targetUser = {
        id: 'superadmin-1',
        name: 'Super Admin',
        email: 'super@example.com',
        password: 'hashed',
        role: Role.SUPERADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);

      await expect(
        service.adminUpdateUser('superadmin-1', { name: 'New Name' }, 'admin-1', 'ADMIN'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('deve lançar ForbiddenException se usuário tentar alterar seu próprio cargo', async () => {
      const targetUser = {
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        password: 'hashed',
        role: Role.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);

      await expect(
        service.adminUpdateUser('user-1', { role: Role.ADMIN }, 'user-1', 'SUPERADMIN'),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException se email já estiver em uso', async () => {
      const targetUser = {
        id: 'user-1',
        name: 'Test',
        email: 'old@example.com',
        password: 'hashed',
        role: Role.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(targetUser)
        .mockResolvedValueOnce({ id: 'user-2', email: 'taken@example.com' });

      await expect(
        service.adminUpdateUser(
          'user-1',
          { email: 'taken@example.com' },
          'superadmin-1',
          'SUPERADMIN',
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException se usuário alvo não existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.adminUpdateUser('user-999', { name: 'New Name' }, 'superadmin-1', 'SUPERADMIN'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('selfDelete', () => {
    it('deve deletar o próprio usuário com sucesso', async () => {
      const targetUser = {
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        password: 'hashed',
        role: Role.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // mock transaction to return target, 0 orders, 0 payments
      mockPrismaService.$transaction.mockResolvedValue([targetUser, 0, 0]);

      mockPrismaService.user.delete.mockResolvedValue(targetUser);

      const result = await service.selfDelete('user-1', Role.USER);

      expect(result).toEqual({ message: 'Usuário removido com sucesso.' });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('deve lançar ForbiddenException se ADMIN tentar deletar SUPERADMIN', async () => {
      const targetUser = {
        id: 'superadmin-1',
        name: 'Super Admin',
        email: 'super@example.com',
        password: 'hashed',
        role: Role.SUPERADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.$transaction.mockResolvedValue([targetUser, 0, 0]);

      await expect(service.selfDelete('superadmin-1', Role.ADMIN)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('deve lançar ConflictException se usuário possuir orders ou payments', async () => {
      const targetUser = {
        id: 'user-2',
        name: 'User With Orders',
        email: 'user2@example.com',
        password: 'hashed',
        role: Role.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // simulate 1 order, 2 payments
      mockPrismaService.$transaction.mockResolvedValue([targetUser, 1, 2]);

      await expect(service.selfDelete('user-2', Role.USER)).rejects.toThrow(ConflictException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException se usuário não existir', async () => {
      mockPrismaService.$transaction.mockResolvedValue([null, 0, 0]);

      await expect(service.selfDelete('nonexistent', Role.USER)).rejects.toThrow(NotFoundException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('deve deletar usuário com sucesso (SUPERADMIN)', async () => {
      const targetUser = {
        id: 'user-1',
        name: 'Test',
        email: 'test@example.com',
        password: 'hashed',
        role: Role.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);
      mockPrismaService.user.delete.mockResolvedValue(targetUser);

      const result = await service.deleteUser('user-1', 'SUPERADMIN');

      expect(result).toEqual({ message: 'Usuário removido com sucesso.' });
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } });
    });

    it('deve lançar ForbiddenException se ADMIN tentar deletar SUPERADMIN', async () => {
      const targetUser = {
        id: 'superadmin-1',
        name: 'Super Admin',
        email: 'super@example.com',
        password: 'hashed',
        role: Role.SUPERADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(targetUser);

      await expect(service.deleteUser('superadmin-1', 'ADMIN')).rejects.toThrow(ForbiddenException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException se usuário não existir', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.deleteUser('user-999', 'SUPERADMIN')).rejects.toThrow(NotFoundException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });
});
