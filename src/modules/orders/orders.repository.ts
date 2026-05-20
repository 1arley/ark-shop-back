import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus, KeyStatus } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { KeysEncryptionProvider } from '@/modules/keys/keys-encryption.provider';
import { userPublicSelect } from '@/common/prisma/user-public.select';

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

      subtotal += product.price.toNumber() * item.quantity;
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
      total: order.total.toNumber(),
      subtotal: order.subtotal.toNumber(),
      discountAmount: order.discountAmount.toNumber(),
      items: order.items.map(item => ({
        ...item,
        price: item.price.toNumber(),
        product: item.product ? { ...item.product, price: item.product.price.toNumber() } : null,
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
      total: order.total.toNumber(),
      subtotal: order.subtotal.toNumber(),
      discountAmount: order.discountAmount.toNumber(),
      items: order.items.map(item => ({
        ...item,
        price: item.price.toNumber(),
        product: item.product ? { ...item.product, price: item.product.price.toNumber() } : null,
        key: item.key ?? null,
      })),
      payment: order.payment ? { ...order.payment, amount: order.payment.amount.toNumber() } : null,
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
        total: order.total.toNumber(),
        subtotal: order.subtotal.toNumber(),
        discountAmount: order.discountAmount.toNumber(),
        items: order.items.map(item => ({
          ...item,
          price: item.price.toNumber(),
          product: item.product ? { ...item.product, price: item.product.price.toNumber() } : null,
          key: item.key ?? null,
        })),
        payment: order.payment
          ? { ...order.payment, amount: order.payment.amount.toNumber() }
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
        total: order.total.toNumber(),
        subtotal: order.subtotal.toNumber(),
        discountAmount: order.discountAmount.toNumber(),
        items: order.items.map(item => ({
          ...item,
          price: item.price.toNumber(),
        })),
        payment: order.payment
          ? { ...order.payment, amount: order.payment.amount.toNumber() }
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
      total: order.total.toNumber(),
      subtotal: order.subtotal.toNumber(),
      discountAmount: order.discountAmount.toNumber(),
      items: order.items.map(item => ({
        ...item,
        price: item.price.toNumber(),
        product: item.product ? { ...item.product, price: item.product.price.toNumber() } : null,
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
    items: Array<{ id: string; productId: string; key: any; product: { name: string } }>,
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
            throw new BadRequestException(`No available keys for product: ${item.product.name}`);
          }

          // Atomically update that specific key only
          await tx.key.update({
            where: { id: availableKey.id },
            data: {
              status: KeyStatus.RESERVED,
              orderItemId: item.id,
            },
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
        total: delivered.total.toNumber(),
        subtotal: delivered.subtotal.toNumber(),
        discountAmount: delivered.discountAmount.toNumber(),
        items: delivered.items.map(item => ({
          ...item,
          price: item.price.toNumber(),
        })),
        payment: delivered.payment
          ? { ...delivered.payment, amount: delivered.payment.amount.toNumber() }
          : null,
      };
    });
  }
}
