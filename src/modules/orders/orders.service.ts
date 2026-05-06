import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, KeyStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private readonly ordersRepository: OrdersRepository) {}

  async create(createOrderDto: CreateOrderDto) {
    return this.ordersRepository.create(createOrderDto);
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
   * This is the critical delivery flow
   */
  async deliverOrder(orderId: string) {
    const order = await this.ordersRepository.findById(orderId);

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (order.status !== OrderStatus.PAID) {
      throw new BadRequestException(
        `Cannot deliver order with status: ${order.status}. Order must be PAID.`,
      );
    }

    // Reserve keys for each order item
    for (const item of order.items) {
      if (!item.key) {
        // Find and reserve an available key for this product
        const availableKey = await this.ordersRepository.reserveAvailableKey(
          item.productId,
          item.id,
        );

        if (!availableKey) {
          throw new BadRequestException(
            `No available keys for product: ${item.product.name}`,
          );
        }
      }
    }

    // Update order status to delivered
    return this.ordersRepository.updateStatus(orderId, OrderStatus.DELIVERED);
  }

  /**
   * Download keys for a delivered order
   * Only the order owner can download keys
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

    // Collect delivered keys from order items
    const deliveredKeys = order.items
      .filter((item) => item.key && item.key.status === KeyStatus.DELIVERED)
      .map((item) => ({
        productName: item.product.name,
        keyId: item.key!.id,
        deliveredAt: item.key!.deliveredAt,
      }));

    return {
      orderId: order.id,
      status: order.status,
      keys: deliveredKeys,
    };
  }
}
