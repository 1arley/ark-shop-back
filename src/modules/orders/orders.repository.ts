import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

  async create(createOrderDto: CreateOrderDto) {
    const { userId, items } = createOrderDto;

    // Calculate total and validate products
    let total = 0;
    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (!product.isActive) {
        throw new BadRequestException(`Product ${product.name} is not active`);
      }

      total += product.price.toNumber() * item.quantity;
    }

    // Create order with items in a transaction
    const order = await this.prisma.order.create({
      data: {
        userId,
        status: OrderStatus.PENDING,
        total,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: 0, // Will be updated when payment is processed
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
      throw new BadRequestException(
        `Invalid status transition from ${order.status} to ${status}`,
      );
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
}
