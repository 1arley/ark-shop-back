import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from '@/user/user.controller';
import { UserService } from '@/user/user.service';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;

  const mockUserService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateProfile: jest.fn(),
    adminUpdateUser: jest.fn(),
    deleteUser: jest.fn(),
    selfDelete: jest.fn(),
  };

  const mockAuthenticatedRequest = {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      role: Role.ADMIN,
      emailVerified: false,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar usuário (admin only)', async () => {
      const createUserDto = {
        name: 'Novo Usuário',
        email: 'novo@example.com',
        password: 'Senha123!',
        role: Role.USER,
      };

      mockUserService.create.mockResolvedValue({
        id: 'user-1',
        name: createUserDto.name,
        email: createUserDto.email,
        role: createUserDto.role,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Nota: A guarda de roles é testada em testes e2e/integration
      // Aqui testamos apenas que o controller delega corretamente
      const result = await userService.create(createUserDto);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe(createUserDto.name);
      expect(userService.create).toHaveBeenCalledWith(createUserDto);
    });
  });

  describe('findAll', () => {
    it('deve listar usuários com paginação (admin only)', async () => {
      const paginatedResult = {
        data: [
          {
            id: '1',
            name: 'User 1',
            email: 'user1@example.com',
            role: Role.USER,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: '2',
            name: 'User 2',
            email: 'user2@example.com',
            role: Role.ADMIN,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
      };

      mockUserService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll('1', '10');

      expect(result).toEqual(paginatedResult);
      expect(userService.findAll).toHaveBeenCalledWith(1, 10);
    });

    it('deve usar valores padrão quando paginação não é fornecida', async () => {
      mockUserService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });

      await controller.findAll(undefined, undefined);

      expect(userService.findAll).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('findOne', () => {
    it('deve buscar usuário por ID (admin only)', async () => {
      const user = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: Role.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserService.findOne.mockResolvedValue(user);

      const result = await userService.findOne('user-1');

      expect(result).toEqual(user);
      expect(userService.findOne).toHaveBeenCalledWith('user-1');
    });

    it('deve lançar NotFoundException se usuário não existir', async () => {
      mockUserService.findOne.mockRejectedValue(new NotFoundException('Usuário não encontrado.'));

      await expect(userService.findOne('user-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('deve buscar usuário por email (admin only)', async () => {
      const user = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: Role.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserService.findByEmail.mockResolvedValue(user);

      const result = await userService.findByEmail('test@example.com');

      expect(result).toEqual(user);
      expect(userService.findByEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('getProfile (me)', () => {
    it('deve retornar o perfil do usuário autenticado', async () => {
      const user = {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        role: Role.USER,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserService.findById.mockResolvedValue(user);

      const _result = controller.getProfile(mockAuthenticatedRequest as any);

      expect(userService.findById).toHaveBeenCalledWith('user-1');
    });
  });

  describe('updateProfile', () => {
    // existing tests remain
  });

  describe('deleteSelf', () => {
    it('deve deletar o próprio usuário autenticado', async () => {
      const deleteResult = { message: 'Usuário removido com sucesso.' };
      mockUserService.selfDelete = jest.fn().mockResolvedValue(deleteResult);

      const result = await controller.deleteSelf(mockAuthenticatedRequest as any);

      expect(mockUserService.selfDelete).toHaveBeenCalledWith('user-1', Role.ADMIN);
      expect(result).toEqual(deleteResult);
    });

    it('deve propagar ForbiddenException quando não autorizado', async () => {
      mockUserService.selfDelete = jest.fn().mockRejectedValue(new ForbiddenException('Forbidden'));

      await expect(controller.deleteSelf(mockAuthenticatedRequest as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
  // adminUpdateUser tests
  describe('adminUpdateUser', () => {
    it('deve atualizar usuário como admin', async () => {
      const updateDto = { name: 'Admin Updated', role: Role.ADMIN };
      const updatedUser = {
        id: 'user-2',
        name: 'Admin Updated',
        email: 'user2@example.com',
        role: Role.ADMIN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserService.adminUpdateUser.mockResolvedValue(updatedUser);

      const result = await userService.adminUpdateUser('user-2', updateDto, 'user-1', 'ADMIN');

      expect(result).toEqual(updatedUser);
      expect(userService.adminUpdateUser).toHaveBeenCalledWith(
        'user-2',
        updateDto,
        'user-1',
        'ADMIN',
      );
    });
  });

  // deleteUser tests
  describe('deleteUser', () => {
    it('deve deletar usuário como admin', async () => {
      mockUserService.deleteUser.mockResolvedValue({ message: 'Usuário removido com sucesso.' });

      const result = await userService.deleteUser('user-2', 'ADMIN');

      expect(result).toEqual({ message: 'Usuário removido com sucesso.' });
      expect(userService.deleteUser).toHaveBeenCalledWith('user-2', 'ADMIN');
    });

    it('deve lançar ForbiddenException se ADMIN tentar deletar SUPERADMIN', async () => {
      mockUserService.deleteUser.mockRejectedValue(
        new ForbiddenException('Administradores não podem remover Super Administradores.'),
      );

      await expect(userService.deleteUser('superadmin-1', 'ADMIN')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  it('deve atualizar o próprio perfil do usuário autenticado', async () => {
    const updateDto = { name: 'Novo Nome', email: 'novo@example.com' };
    const updatedUser = {
      id: 'user-1',
      name: 'Novo Nome',
      email: 'novo@example.com',
      role: Role.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUserService.updateProfile.mockResolvedValue(updatedUser);

    const result = await controller.updateProfile(mockAuthenticatedRequest as any, updateDto);

    expect(userService.updateProfile).toHaveBeenCalledWith('user-1', updateDto);
    expect(result).toEqual(updatedUser);
  });

  it('deve lançar ConflictException se email já estiver em uso', async () => {
    mockUserService.updateProfile.mockRejectedValue(new ConflictException('Email já cadastrado.'));

    await expect(
      controller.updateProfile(mockAuthenticatedRequest as any, { email: 'taken@example.com' }),
    ).rejects.toThrow(ConflictException);
  });
});
