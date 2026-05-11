import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, KeyStatus } from '@prisma/client';
import type { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { KeysService } from '@/modules/keys/keys.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly keysService: KeysService,
    private readonly prisma: PrismaService,
  ) {}

  async create(createOrderDto: CreateOrderDto, userId: string) {
    return this.ordersRepository.create(createOrderDto, userId);
  }

  async findById(id: string) {
    return this.ordersRepository.findById(id);
  }

  async findByUser(userId: string, page: number = 1, limit: number = 10) {
    return this.ordersRepository.findByUser(userId, page, limit);
  }

  async updateStatus(id: string, status: OrderStatus) {
    return this.ordersRepository.updateStatus(id, status);
  }

  async cancel(id: string) {
    return this.ordersRepository.cancel(id);
  }

  async getRecentOrders(limit: number = 10) {
    return this.ordersRepository.getRecentOrders(limit);
  }

  /**
   * Deliver order - reserve keys and mark as delivered
   * This is the critical delivery flow - wrapped in transaction for data integrity
   */
  async deliverOrder(orderId: string) {
    // Use transaction to ensure atomic delivery
    return this.prisma.$transaction(async tx => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
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
        throw new BadRequestException('Order not found');
      }

      if (order.status !== OrderStatus.PAID) {
        throw new BadRequestException(
          `Cannot deliver order with status: ${order.status}. Order must be PAID.`,
        );
      }

      // Reserve keys for each order item atomically
      for (const item of order.items) {
        if (!item.key) {
          // Find and reserve an available key for this product
          const availableKey = await tx.key.findFirst({
            where: {
              productId: item.productId,
              status: KeyStatus.AVAILABLE,
            },
          });

          if (!availableKey) {
            throw new BadRequestException(`No available keys for product: ${item.product.name}`);
          }

          // Reserve the key
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
    });
  }

  /**
   * Download keys for a delivered order
   * Only the order owner can download keys
   * Returns decrypted key data
   */
  async downloadKeys(orderId: string, userId: string) {
    const order = await this.ordersRepository.findById(orderId);

    // Verify ownership
    if (order.user.id !== userId) {
      throw new ForbiddenException('You can only download keys from your own orders');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'Order not delivered yet. Keys will be available after delivery.',
      );
    }

    // Collect delivered keys with decrypted data
    const deliveredKeys = await Promise.all(
      order.items
        .filter(item => item.key && item.key.status === KeyStatus.DELIVERED)
        .map(async item => {
          // Get decrypted key data
          const keyData = await this.keysService.deliverKey(item.key!.id);

          return {
            productName: item.product.name,
            keyId: item.key!.id,
            deliveredAt: item.key!.deliveredAt,
            decryptedKey: keyData.decryptedKey, // Return the actual key code
          };
        }),
    );

    return {
      orderId: order.id,
      status: order.status,
      keys: deliveredKeys,
    };
  }
}
