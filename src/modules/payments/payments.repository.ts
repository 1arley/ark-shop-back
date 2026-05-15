import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentProvider, PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { PaymentProviderFactory } from './payment-provider.factory';

@Injectable()
export class PaymentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providerFactory: PaymentProviderFactory,
  ) {}

  async createPayment(
    orderId: string,
    userId: string,
    amount: number,
    provider: PaymentProvider,
    method: PaymentMethod,
  ) {
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        userId,
        provider,
        method,
        amount,
        status: PaymentStatus.PENDING,
      },
      include: {
        order: true,
      },
    });

    return payment;
  }

  async createPixPayment(
    orderId: string,
    userId: string,
    amount: number,
    provider: PaymentProvider,
    pixData: {
      providerTxId?: string;
      pixQrCode: string;
      pixCode: string;
      expiresAt?: Date;
    },
  ) {
    return this.prisma.payment.create({
      data: {
        orderId,
        userId,
        provider,
        method: PaymentMethod.PIX,
        amount,
        status: PaymentStatus.PENDING,
        pixQrCode: pixData.pixQrCode,
        pixCode: pixData.pixCode,
        ...(pixData.providerTxId && { providerTxId: pixData.providerTxId }),
        ...(pixData.expiresAt && { expiresAt: pixData.expiresAt }),
      },
      include: {
        order: true,
      },
    });
  }

  async findById(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        },
        user: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return payment;
  }

  async findByOrderId(orderId: string) {
    return this.prisma.payment.findUnique({
      where: { orderId },
      include: {
        order: true,
        user: true,
      },
    });
  }

  async updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    providerTxId?: string,
    webhookData?: any,
  ) {
    return this.prisma.payment.update({
      where: { id },
      data: {
        status,
        ...(providerTxId && { providerTxId }),
        ...(webhookData && { webhookData }),
      },
      include: {
        order: true,
      },
    });
  }

  async approvePayment(id: string, providerTxId: string, webhookData?: any) {
    const payment = await this.findById(id);

    return this.prisma.$transaction(async tx => {
      // Update payment status
      const updatedPayment = await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.APPROVED,
          providerTxId,
          ...(webhookData && { webhookData }),
        },
        include: { order: true },
      });

      // Update order status
      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.PAID },
      });

      return updatedPayment;
    });
  }

  async rejectPayment(id: string, reason?: string) {
    const payment = await this.findById(id);

    return this.prisma.$transaction(async tx => {
      await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.REJECTED,
          ...(reason && { rejectionReason: reason }),
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: OrderStatus.CANCELLED },
      });
    });
  }

  async getPaymentsByUser(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [payments, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where: { userId },
        skip,
        take: limit,
        include: {
          order: {
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where: { userId } }),
    ]);

    return {
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByProviderTxId(providerTxId: string) {
    // Find by providerTxId using findFirst since it's not a unique index
    return this.prisma.payment.findFirst({
      where: { providerTxId },
      include: {
        order: true,
        user: true,
      },
    });
  }
}
