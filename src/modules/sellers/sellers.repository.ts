import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateSellerDto, UpdateSellerDto } from './dto/create-seller.dto';
import { toNumber } from '@/common/decimal';

@Injectable()
export class SellersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSellerDto) {
    const seller = await this.prisma.seller.create({
      data: {
        userId: data.userId,
        companyName: data.companyName,
        document: data.document,
        commission: data.commission ?? 10,
        isActive: data.isActive ?? true,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      ...seller,
      commission: toNumber(seller.commission),
    };
  }

  /**
   * Atualiza os dados da integração Asaas no seller
   * (chamado após criar a subconta no Asaas)
   */
  async updateAsaasData(id: string, data: { asaasAccountId: string; asaasWalletId: string }) {
    const seller = await this.prisma.seller.update({
      where: { id },
      data: {
        asaasAccountId: data.asaasAccountId,
        asaasWalletId: data.asaasWalletId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      ...seller,
      commission: toNumber(seller.commission),
    };
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
      data: data.map(s => ({
        ...s,
        commission: toNumber(s.commission),
      })),
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

    return {
      ...seller,
      commission: toNumber(seller.commission),
    };
  }

  async update(id: string, data: UpdateSellerDto) {
    const seller = await this.prisma.seller.update({
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

    return {
      ...seller,
      commission: toNumber(seller.commission),
    };
  }

  async delete(id: string) {
    return this.prisma.seller.delete({ where: { id } });
  }
}
