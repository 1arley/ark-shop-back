import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateSellerDto, UpdateSellerDto } from './dto/create-seller.dto';

@Injectable()
export class SellersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSellerDto, asaasAccountId?: string, asaasWalletId?: string) {
    return this.prisma.seller.create({
      data: {
        userId: data.userId,
        companyName: data.companyName,
        document: data.document,
        commission: data.commission ?? 10,
        isActive: data.isActive ?? true,
        asaasAccountId,
        asaasWalletId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.seller.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.seller.count(),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Seller não encontrado.');
    }

    return seller;
  }

  async update(id: string, data: UpdateSellerDto) {
    await this.findById(id);

    return this.prisma.seller.update({
      where: { id },
      data: {
        companyName: data.companyName,
        document: data.document,
        commission: data.commission,
        isActive: data.isActive,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);

    return this.prisma.seller.delete({ where: { id } });
  }
}
