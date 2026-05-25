import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentProvider, PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { userPublicSelect } from '@/common/prisma/user-public.select';
import { toNumber } from '@/common/decimal';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

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

    return {
      ...payment,
      amount: toNumber(payment.amount),
    };
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
    const payment = await this.prisma.payment.create({
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

    return {
      ...payment,
      amount: toNumber(payment.amount),
    };
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
        user: { select: userPublicSelect },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return {
      ...payment,
      amount: toNumber(payment.amount),
      order: payment.order
        ? {
            ...payment.order,
            total: toNumber(payment.order.total),
            subtotal: toNumber(payment.order.subtotal),
            discountAmount: toNumber(payment.order.discountAmount),
            items: payment.order.items.map(item => ({
              ...item,
              price: toNumber(item.price),
              product: item.product
                ? { ...item.product, price: toNumber(item.product.price) }
                : null,
            })),
          }
        : null,
    };
  }

  async findByOrderId(orderId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: {
        order: true,
        user: { select: userPublicSelect },
      },
    });

    if (!payment) return null;

    return {
      ...payment,
      amount: toNumber(payment.amount),
    };
  }

  async updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    providerTxId?: string,
    webhookData?: any,
  ) {
    return this.prisma.payment
      .update({
        where: { id },
        data: {
          status,
          ...(providerTxId && { providerTxId }),
          ...(webhookData && { webhookData }),
        },
        include: {
          order: true,
        },
      })
      .then(payment => ({
        ...payment,
        amount: toNumber(payment.amount),
      }));
  }

  async approvePayment(id: string, providerTxId: string, webhookData?: any) {
    return this.prisma.$transaction(async tx => {
      // Fetch payment inside transaction for atomicity
      const payment = await tx.payment.findUnique({
        where: { id },
        include: { order: true },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${id} not found`);
      }

      // Idempotency: if already approved, return as-is
      if (payment.status === PaymentStatus.APPROVED) {
        return payment;
      }

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

      return {
        ...updatedPayment,
        amount: toNumber(updatedPayment.amount),
      };
    });
  }

  async rejectPayment(id: string, reason?: string) {
    return this.prisma.$transaction(async tx => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: { order: true },
      });

      if (!payment) {
        throw new NotFoundException(`Payment with ID ${id} not found`);
      }

      const updatedPayment = await tx.payment.update({
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

      return {
        ...updatedPayment,
        amount: toNumber(updatedPayment.amount),
      };
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
      data: payments.map(p => ({
        ...p,
        amount: toNumber(p.amount),
        order: p.order
          ? {
              ...p.order,
              total: toNumber(p.order.total),
              subtotal: toNumber(p.order.subtotal),
              discountAmount: toNumber(p.order.discountAmount),
              items: p.order.items.map(item => ({
                ...item,
                price: toNumber(item.price),
                product: item.product
                  ? { ...item.product, price: toNumber(item.product.price) }
                  : null,
              })),
            }
          : null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByProviderTxId(providerTxId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerTxId },
      include: {
        order: true,
        user: { select: userPublicSelect },
      },
    });

    if (!payment) return null;

    return {
      ...payment,
      amount: toNumber(payment.amount),
    };
  }
}
