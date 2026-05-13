import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateUserDto } from '@/dto/create-user.dto';
import { UpdateProfileDto } from '@/user/dto/update-profile.dto';
import { AdminUpdateUserDto } from '@/user/dto/admin-update-user.dto';
import * as bcrypt from 'bcrypt';
import { DEFAULT_PAGE_SIZE } from '@/common/constants';
import { Role } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { name, email, password } = createUserDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email já cadastrado.');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.USER, // Força role USER — impossível auto-cadastrar como admin
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findAll(page: number = 1, limit: number = DEFAULT_PAGE_SIZE) {
    const skip = (page - 1) * limit;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    const safeUsers = users.map(user => {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return {
      data: safeUsers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException('Email já cadastrado.');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        avatarUrl: dto.avatarUrl,
      },
    });

    const { password: _, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  }

  async adminUpdateUser(
    id: string,
    dto: AdminUpdateUserDto,
    requestingUserId?: string,
    requestingUserRole?: string,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (dto.email && dto.email !== target.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException('Email já cadastrado.');
      }
    }

    if (dto.role && !['USER', 'ADMIN', 'SUPERADMIN'].includes(dto.role)) {
      throw new BadRequestException('Role inválida. Use: USER, ADMIN ou SUPERADMIN.');
    }

    // ─── Regras de segurança ──────────────────────────────────────────
    const isSuperadminTarget = target.role === 'SUPERADMIN';
    const isAdminRequesting = requestingUserRole === 'ADMIN';

    // 1. ADMIN não pode modificar SUPERADMIN
    if (isAdminRequesting && isSuperadminTarget) {
      throw new ForbiddenException('Administradores não podem modificar Super Administradores.');
    }

    // 2. ADMIN não pode alterar cargos
    if (isAdminRequesting && dto.role) {
      throw new ForbiddenException('Apenas Super Administradores podem alterar cargos.');
    }

    // 3. Ninguém pode alterar o próprio cargo (evita auto-promoção ou auto-rebaixamento)
    if (dto.role && id === requestingUserId) {
      throw new ForbiddenException('Você não pode alterar seu próprio cargo.');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        avatarUrl: dto.avatarUrl,
      },
    });

    const { password: _, ...userWithoutPassword } = updated;
    return userWithoutPassword;
  }

  async deleteUser(id: string, requestingUserRole?: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    // ADMIN não pode excluir SUPERADMIN
    if (requestingUserRole === 'ADMIN' && target.role === 'SUPERADMIN') {
      throw new ForbiddenException('Administradores não podem remover Super Administradores.');
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuário removido com sucesso.' };
  }
}
