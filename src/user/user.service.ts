import {
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateUserDto } from '@/dto/create-user.dto';
import { UpdateProfileDto } from '@/user/dto/update-profile.dto';
import { AdminUpdateUserDto } from '@/user/dto/admin-update-user.dto';
import * as bcrypt from 'bcrypt';
import { DEFAULT_PAGE_SIZE, DEFAULT_BCRYPT_SALT_ROUNDS } from '@/common/constants';
import { Role } from '@prisma/client';
import {
  userExistsSelect,
  userPublicSelect,
  type UserPublic,
} from '@/common/prisma/user-public.select';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const { name, email, password, role } = createUserDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: userExistsSelect,
    });

    if (existingUser) {
      throw new ConflictException('Email already registered.');
    }

    const hashedPassword = await bcrypt.hash(password, DEFAULT_BCRYPT_SALT_ROUNDS);

    return this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || Role.USER,
      },
      select: userPublicSelect,
    });
  }

  async findById(id: string): Promise<UserPublic> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userPublicSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async findAll(page: number = 1, limit: number = DEFAULT_PAGE_SIZE) {
    const skip = (page - 1) * limit;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: userPublicSelect,
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<UserPublic> {
    return this.findById(id);
  }

  async findByEmail(email: string): Promise<UserPublic> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: userPublicSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userExistsSelect,
    });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const isEmailChanging = dto.email && dto.email !== user.email;

    if (isEmailChanging) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: userExistsSelect,
      });
      if (existing) {
        throw new ConflictException('Email already registered.');
      }
    }

    // When email changes, reset emailVerified so the user must re-verify.
    // This prevents identity takeover without confirmation (OWASP API #3).
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
        // Reset email verification if the email changed
        ...(isEmailChanging ? { emailVerified: false } : {}),
      },
      select: userPublicSelect,
    });

    // If email changed, invalidate existing refresh tokens so the user must log in again
    // and revoke any pending email verification codes
    if (isEmailChanging) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
      await this.prisma.emailVerificationToken.deleteMany({
        where: { userId: id, usedAt: null },
      });
    }

    return updatedUser;
  }

  async adminUpdateUser(
    id: string,
    dto: AdminUpdateUserDto,
    requestingUserId: string,
    requestingUserRole: string,
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: userExistsSelect,
    });
    if (!target) {
      throw new NotFoundException('User not found.');
    }

    if (dto.email && dto.email !== target.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: userExistsSelect,
      });
      if (existing) {
        throw new ConflictException('Email already registered.');
      }
    }

    // ─── Regras de permissão ──────────────────────────────────────────
    const isAdmin = requestingUserRole === 'ADMIN';
    const isSuperadminTarget = target.role === 'SUPERADMIN';

    // ADMIN não pode alterar cargo de ninguém
    if (isAdmin && dto.role) {
      throw new ForbiddenException('Apenas Super Administradores podem alterar cargos.');
    }

    // ADMIN não pode modificar SUPERADMIN
    if (isAdmin && isSuperadminTarget) {
      throw new ForbiddenException('Administradores não podem modificar Super Administradores.');
    }

    // Ninguém pode alterar o próprio cargo
    if (dto.role && id === requestingUserId) {
      throw new ForbiddenException('Você não pode alterar seu próprio cargo.');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        avatarUrl: dto.avatarUrl,
      },
      select: userPublicSelect,
    });
  }

  /**
   * Delete the authenticated user (self‑deletion).
   *
   * - Prevents a non‑SUPERADMIN from deleting a SUPERADMIN.
   * - Blocks deletion if the user owns any Order or Payment records.
   * - Writes an audit entry (if the table exists) before removal.
   */
  async selfDelete(userId: string, requestingUserRole: string) {
    // Fetch the target user and any blocking relations atomically
    const [target, ordersCount, paymentsCount] = await this.prisma.$transaction([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: userExistsSelect,
      }),
      this.prisma.order.count({ where: { userId } }),
      this.prisma.payment.count({ where: { userId } }),
    ]);

    if (!target) {
      throw new NotFoundException('User not found.');
    }

    // SUPERADMIN can only be deleted by another SUPERADMIN (self‑deletion allowed)
    if (target.role === 'SUPERADMIN' && requestingUserRole !== 'SUPERADMIN') {
      throw new ForbiddenException('Only a SUPERADMIN can delete a SUPERADMIN account.');
    }

    // Prevent FK violations for orders/payments
    if (ordersCount > 0 || paymentsCount > 0) {
      throw new ConflictException(
        `User has ${ordersCount} orders and ${paymentsCount} payments; cannot delete.`,
      );
    }

    // Optional audit log – ignore errors if the table does not exist
    await this.prisma.userDeletionLog
      ?.create({
        data: {
          userId,
          deletedAt: new Date(),
          performedBy: userId,
        },
      })
      .catch(() => undefined);

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Usuário removido com sucesso.' };
  }

  async deleteUser(id: string, requestingUserRole: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: userExistsSelect,
    });
    if (!target) {
      throw new NotFoundException('User not found.');
    }

    // ADMIN não pode excluir SUPERADMIN
    if (requestingUserRole === 'ADMIN' && target.role === 'SUPERADMIN') {
      throw new ForbiddenException('Administradores não podem remover Super Administradores.');
    }

    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuário removido com sucesso.' };
  }
}
