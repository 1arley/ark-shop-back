import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, KeyStatus } from '@prisma/client';
import { KeysService } from '@/modules/keys/keys.service';
import { CouponsService } from '@/modules/coupons/coupons.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly keysService: KeysService,
    private readonly couponsService: CouponsService,
  ) {}

  async create(createOrderDto: CreateOrderDto, userId: string) {
    let couponData: { couponId: string; discountAmount: number } | undefined;

    // Validate and calculate discount if coupon code is provided
    if (createOrderDto.couponCode) {
      // First calculate subtotal to validate coupon
      const subtotal = await this.calculateSubtotal(createOrderDto);

      const validationResult = await this.couponsService.validateAndCalculate({
        code: createOrderDto.couponCode,
        subtotal,
      });

      if (!validationResult.valid) {
        throw new BadRequestException(validationResult.message);
      }

      couponData = {
        couponId: validationResult.coupon!.id,
        discountAmount: validationResult.discountAmount,
      };
    }

    const order = await this.ordersRepository.create(createOrderDto, userId, couponData);

    // Mark coupon as used after successful order creation
    if (couponData) {
      await this.couponsService.markAsUsed(couponData.couponId);
      this.logger.log(
        `Coupon ${createOrderDto.couponCode} used for order ${order.id} — discount: R$ ${couponData.discountAmount.toFixed(2)}`,
      );
    }

    return order;
  }

  /**
   * Calculate subtotal from order items (without discount).
   */
  private async calculateSubtotal(createOrderDto: CreateOrderDto): Promise<number> {
    const productIds = createOrderDto.items.map(i => i.productId);
    const products = await this.ordersRepository.getProductsByIds(productIds);

    const productMap = new Map(products.map(p => [p.id, p]));

    let subtotal = 0;
    for (const item of createOrderDto.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }
      if (!product.isActive) {
        throw new BadRequestException(`Product ${product.name} is not active`);
      }
      subtotal += product.price.toNumber() * item.quantity;
    }

    return subtotal;
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

    // Wrap key reservation in a transaction to prevent TOCTOU race conditions
    return this.ordersRepository.deliverOrderAtomic(orderId, order.items);
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
          // Read-only decrypt (no status update needed — keys are already delivered)
          const decryptedKey = await this.keysService.getDecryptedKey(item.key!.id);

          return {
            productName: item.product.name,
            keyId: item.key!.id,
            deliveredAt: item.key!.deliveredAt,
            decryptedKey,
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
