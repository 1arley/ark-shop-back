import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { OrdersRepository } from './orders.repository';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, KeyStatus } from '@prisma/client';
import { KeysService } from '@/modules/keys/keys.service';
import { AccountsService } from '@/modules/accounts/accounts.service';
import { CouponsService } from '@/modules/coupons/coupons.service';
import { toNumber } from '@/common/decimal';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly keysService: KeysService,
    private readonly accountsService: AccountsService,
    private readonly couponsService: CouponsService,
  ) {}

  async create(createOrderDto: CreateOrderDto, userId: string) {
    let couponData:
      | { couponId: string; discountAmount: number; maxUses: number | null }
      | undefined;

    if (createOrderDto.couponCode) {
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
        maxUses: validationResult.coupon!.maxUses ?? null,
      };
    }

    const order = await this.ordersRepository.create(createOrderDto, userId, couponData);

    if (couponData) {
      const incremented = await this.couponsService.markAsUsedIfAvailable(
        couponData.couponId,
        couponData.maxUses,
      );
      if (!incremented) {
        this.logger.warn(
          `Coupon ${createOrderDto.couponCode} reached maxUses during order ${order.id} — ` +
            'discount was applied but usage count could not be incremented',
        );
      } else {
        this.logger.log(
          `Coupon ${createOrderDto.couponCode} used for order ${order.id} — discount: R$ ${couponData.discountAmount.toFixed(2)}`,
        );
      }
    }

    return order;
  }

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
      subtotal += toNumber(product.price)! * item.quantity;
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

    return this.ordersRepository.deliverOrderAtomic(orderId, order.items);
  }

  async downloadItems(orderId: string, userId: string) {
    const order = await this.ordersRepository.findById(orderId);

    if ((order as any).user?.id !== userId) {
      throw new ForbiddenException('You can only download items from your own orders');
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'Order not delivered yet. Items will be available after delivery.',
      );
    }

    const deliveredKeys = await Promise.all(
      order.items
        .filter((item: any) => item.key && item.key.status === KeyStatus.DELIVERED)
        .map(async (item: any) => {
          const decryptedKey = await this.keysService.getDecryptedKey(item.key!.id);
          return {
            productName: item.product?.name ?? 'Unknown',
            keyId: item.key!.id,
            deliveredAt: item.key!.deliveredAt,
            decryptedKey,
          };
        }),
    );

    const deliveredAccounts = await Promise.all(
      order.items
        .filter((item: any) => item.account && item.account.status === KeyStatus.DELIVERED)
        .map(async (item: any) => {
          const decrypted = await this.accountsService.getDecryptedAccount(item.account!.id);
          return {
            productName: item.product?.name ?? 'Unknown',
            accountId: item.account!.id,
            deliveredAt: item.account!.deliveredAt,
            email: decrypted.email,
            password: decrypted.password,
            metadata: decrypted.metadata,
            instructions: item.product?.instructions ?? null,
          };
        }),
    );

    return {
      orderId: order.id,
      status: order.status,
      keys: deliveredKeys,
      accounts: deliveredAccounts,
    };
  }
}
