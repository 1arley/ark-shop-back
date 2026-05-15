import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus, KeyStatus } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { KeysEncryptionProvider } from '@/modules/keys/keys-encryption.provider';

@Injectable()
export class OrdersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keysEncryption: KeysEncryptionProvider,
  ) {}

  async create(createOrderDto: CreateOrderDto, userId: string) {
    const { items } = createOrderDto;

    // Batch fetch all products in a single query (fixes N+1)
    const productIds = items.map(i => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    // Calculate total and validate products
    let total = 0;
    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (!product.isActive) {
        throw new BadRequestException(`Product ${product.name} is not active`);
      }

      total += product.price.toNumber() * item.quantity;
    }

    // Create order with items in a transaction
    // Salva o preço real de cada item no momento da compra para integridade financeira
    const order = await this.prisma.order.create({
      data: {
        userId,
        status: OrderStatus.PENDING,
        total,
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
      },
    });

    return order;
  }

  async findById(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: {
          include: {
            product: true,
            key: true,
          },
        },
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
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
              key: true,
            },
          },
          payment: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      data: orders,
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

    return this.prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: true,
        payment: true,
      },
    });
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
    return this.prisma.order.findMany({
      take: limit,
      include: {
        user: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Reserve an available key for a product
   * This is part of the delivery flow
   */
  async reserveAvailableKey(productId: string, orderItemId: string) {
    // Find an available key for this product
    const availableKey = await this.prisma.key.findFirst({
      where: {
        productId,
        status: KeyStatus.AVAILABLE,
      },
    });

    if (!availableKey) {
      return null;
    }

    // Reserve the key by updating its status and linking to order item
    const reservedKey = await this.prisma.key.update({
      where: { id: availableKey.id },
      data: {
        status: KeyStatus.RESERVED,
        orderItemId,
      },
      include: {
        product: true,
      },
    });

    return reservedKey;
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
   * Wraps the entire flow in a $transaction to prevent TOCTOU race conditions
   * where concurrent requests could grab the same key.
   */
  async deliverOrderAtomic(
    orderId: string,
    items: Array<{ id: string; productId: string; key: any; product: { name: string } }>,
  ) {
    return this.prisma.$transaction(async tx => {
      for (const item of items) {
        if (!item.key) {
          // Atomic find-and-reserve within the transaction
          const availableKey = await tx.key.findFirst({
            where: {
              productId: item.productId,
              status: KeyStatus.AVAILABLE,
            },
          });

          if (!availableKey) {
            throw new BadRequestException(`No available keys for product: ${item.product.name}`);
          }

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
      return tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DELIVERED },
        include: {
          items: true,
          payment: true,
        },
      });
    });
  }
}
