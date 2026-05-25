import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus, KeyStatus } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { KeysEncryptionProvider } from '@/modules/keys/keys-encryption.provider';
import { userPublicSelect } from '@/common/prisma/user-public.select';
import { toNumber } from '@/common/decimal';

@Injectable()
export class OrdersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keysEncryption: KeysEncryptionProvider,
  ) {}

  async create(
    createOrderDto: CreateOrderDto,
    userId: string,
    couponData?: { couponId: string; discountAmount: number },
  ) {
    const { items } = createOrderDto;

    // Batch fetch all products in a single query (fixes N+1)
    const productIds = items.map(i => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    // Calculate subtotal and validate products
    let subtotal = 0;
    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (!product.isActive) {
        throw new BadRequestException(`Product ${product.name} is not active`);
      }

      subtotal += toNumber(product.price)! * item.quantity;
    }

    const discountAmount = couponData?.discountAmount ?? 0;
    const total = subtotal - discountAmount;

    // Create order with items in a transaction
    // Salva o preço real de cada item no momento da compra para integridade financeira
    const order = await this.prisma.order.create({
      data: {
        userId,
        status: OrderStatus.PENDING,
        subtotal,
        total,
        discountAmount,
        couponId: couponData?.couponId ?? null,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: productMap.get(item.productId)!.price,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        payment: true,
        coupon: true,
      },
    });

    // Serialize Decimal fields for JSON response
    const serializedOrder = {
      ...order,
      total: toNumber(order.total),
      subtotal: toNumber(order.subtotal),
      discountAmount: toNumber(order.discountAmount),
      items: order.items.map(item => ({
        ...item,
        price: toNumber(item.price),
        product: item.product ? { ...item.product, price: toNumber(item.product.price) } : null,
      })),
      payment: order.payment ? { ...order.payment, amount: order.payment.amount.toNumber() } : null,
      coupon: order.coupon ? { ...order.coupon, value: order.coupon.value.toNumber() } : null,
    };

    return serializedOrder;
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: userPublicSelect },
        items: {
          include: {
            product: true,
            key: {
              // Exclude encrypted keyData from API responses
              select: {
                id: true,
                status: true,
                deliveredAt: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Serialize Decimal fields
    const serialized = {
      ...order,
      total: toNumber(order.total),
      subtotal: toNumber(order.subtotal),
      discountAmount: toNumber(order.discountAmount),
      items: order.items.map(item => ({
        ...item,
        price: toNumber(item.price),
        product: item.product ? { ...item.product, price: toNumber(item.product.price) } : null,
        key: item.key ?? null,
      })),
      payment: order.payment ? { ...order.payment, amount: toNumber(order.payment.amount) } : null,
    };

    return serialized;
  }

  async findByUser(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { userId },
        skip,
        take: limit,
        include: {
          items: {
            include: {
              product: true,
              key: {
                // Exclude encrypted keyData from API responses
                select: {
                  id: true,
                  status: true,
                  deliveredAt: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
          },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      data: orders.map(order => ({
        ...order,
        total: toNumber(order.total),
        subtotal: toNumber(order.subtotal),
        discountAmount: toNumber(order.discountAmount),
        items: order.items.map(item => ({
          ...item,
          price: toNumber(item.price),
          product: item.product ? { ...item.product, price: toNumber(item.product.price) } : null,
          key: item.key ?? null,
        })),
        payment: order.payment
          ? { ...order.payment, amount: toNumber(order.payment.amount) }
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

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          where: { keyId: { not: null } },
          select: { id: true, keyId: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Validate status transition
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      PENDING: ['AWAITING_PAYMENT', 'CANCELLED'],
      AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
      PAID: ['PROCESSING', 'DELIVERED', 'REFUNDED'],
      PROCESSING: ['DELIVERED', 'CANCELLED'],
      DELIVERED: [],
      CANCELLED: [],
      REFUNDED: [],
    };

    if (!validTransitions[order.status].includes(status)) {
      throw new BadRequestException(`Invalid status transition from ${order.status} to ${status}`);
    }

    // Se for cancelamento, libera as chaves reservadas de volta para AVAILABLE
    if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) {
      const reservedKeyIds = order.items.filter(item => item.keyId).map(item => item.keyId!);

      if (reservedKeyIds.length > 0) {
        await this.prisma.key.updateMany({
          where: { id: { in: reservedKeyIds } },
          data: {
            status: KeyStatus.AVAILABLE,
            orderItemId: null,
          },
        });
      }
    }

    return this.prisma.order
      .update({
        where: { id },
        data: { status },
        include: {
          items: true,
          payment: true,
        },
      })
      .then(order => ({
        ...order,
        total: toNumber(order.total),
        subtotal: toNumber(order.subtotal),
        discountAmount: toNumber(order.discountAmount),
        items: order.items.map(item => ({
          ...item,
          price: toNumber(item.price),
        })),
        payment: order.payment
          ? { ...order.payment, amount: toNumber(order.payment.amount) }
          : null,
      }));
  }

  async cancel(id: string) {
    return this.updateStatus(id, OrderStatus.CANCELLED);
  }

  async countByUser(userId: string) {
    return this.prisma.order.count({
      where: { userId },
    });
  }

  async getRecentOrders(limit: number = 10) {
    const orders = await this.prisma.order.findMany({
      take: limit,
      include: {
        user: { select: userPublicSelect },
        items: {
          include: {
            product: true,
            key: {
              select: {
                id: true,
                status: true,
                deliveredAt: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return orders.map(order => ({
      ...order,
      total: toNumber(order.total),
      subtotal: toNumber(order.subtotal),
      discountAmount: toNumber(order.discountAmount),
      items: order.items.map(item => ({
        ...item,
        price: toNumber(item.price),
        product: item.product ? { ...item.product, price: toNumber(item.product.price) } : null,
        key: item.key ?? null,
      })),
    }));
  }

  /**
   * Fetch products by IDs (used by OrdersService for subtotal calculation).
   */
  async getProductsByIds(ids: string[]) {
    return this.prisma.product.findMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Reserve an available key for a product atomically.
   * Uses updateMany with a WHERE condition to prevent TOCTOU race conditions.
   */
  async reserveAvailableKey(productId: string, orderItemId: string) {
    // Atomic reserve: updateMany only affects keys that are still AVAILABLE
    const result = await this.prisma.key.updateMany({
      where: {
        productId,
        status: KeyStatus.AVAILABLE,
      },
      data: {
        status: KeyStatus.RESERVED,
        orderItemId,
      },
    });

    if (result.count === 0) {
      return null;
    }

    // Fetch the reserved key
    return this.prisma.key.findFirst({
      where: { orderItemId },
      include: { product: true },
    });
  }

  /**
   * Deliver a key (decrypt and mark as delivered)
   */
  async deliverKey(keyId: string) {
    const key = await this.prisma.key.update({
      where: { id: keyId },
      data: {
        status: KeyStatus.DELIVERED,
        deliveredAt: new Date(),
      },
      include: {
        product: true,
        orderItem: true,
      },
    });

    // Decrypt the key for delivery
    const decryptedKey = this.keysEncryption.decrypt(key.keyData);

    return {
      ...key,
      decryptedKey,
    };
  }

  /**
   * Atomically reserve keys and mark order as delivered.
   * Reserves exactly ONE key per item by finding first available key
   * then updating that specific key within the transaction.
   */
  async deliverOrderAtomic(
    orderId: string,
    items: Array<{
      id: string;
      productId: string;
      key: {
        id: string;
        status: KeyStatus;
        createdAt: Date;
        updatedAt: Date;
        deliveredAt: Date | null;
      } | null;
      product: { name: string } | null;
    }>,
  ) {
    return this.prisma.$transaction(async tx => {
      // Re-verify order status inside transaction to prevent concurrent delivery
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== OrderStatus.PAID) {
        throw new BadRequestException('Order must be in PAID status to deliver');
      }

      for (const item of items) {
        if (!item.key) {
          // Find ONE available key first
          const availableKey = await tx.key.findFirst({
            where: {
              productId: item.productId,
              status: KeyStatus.AVAILABLE,
            },
          });

          if (!availableKey) {
            throw new BadRequestException(
              `No available keys for product: ${item.product?.name ?? item.productId}`,
            );
          }

          // Atomically update that specific key only
          await tx.key.update({
            where: { id: availableKey.id },
            data: {
              status: KeyStatus.RESERVED,
              orderItemId: item.id,
            },
          });

          // Also set the OrderItem.keyId to establish the bidirectional relation
          await tx.orderItem.update({
            where: { id: item.id },
            data: { keyId: availableKey.id },
          });
        }
      }

      // Update order status to delivered
      const delivered = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DELIVERED },
        include: {
          items: true,
          payment: true,
        },
      });

      return {
        ...delivered,
        total: toNumber(delivered.total),
        subtotal: toNumber(delivered.subtotal),
        discountAmount: toNumber(delivered.discountAmount),
        items: delivered.items.map(item => ({
          ...item,
          price: toNumber(item.price),
        })),
        payment: delivered.payment
          ? { ...delivered.payment, amount: toNumber(delivered.payment.amount) }
          : null,
      };
    });
  }
}
