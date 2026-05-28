import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus, KeyStatus, Prisma } from '@prisma/client';
import type { ProductType } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { KeysEncryptionProvider } from '@/modules/keys/keys-encryption.provider';
import { userPublicSelect } from '@/common/prisma/user-public.select';
import { toNumber } from '@/common/decimal';

const PRODUCT_TYPE_KEY = 'KEY' as ProductType;
const PRODUCT_TYPE_ACCOUNT = 'ACCOUNT' as ProductType;

interface ItemWithProduct {
  id: string;
  productId: string;
  quantity: number;
  product: { name: string; productType: ProductType } | null;
  key: {
    id: string;
    status: KeyStatus;
    createdAt: Date;
    updatedAt: Date;
    deliveredAt: Date | null;
  } | null;
  account: {
    id: string;
    status: KeyStatus;
    createdAt: Date;
    updatedAt: Date;
    deliveredAt: Date | null;
  } | null;
}

@Injectable()
export class OrdersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keysEncryption: KeysEncryptionProvider,
  ) {}

  private async syncProductStock(productId: string, tx: Prisma.TransactionClient) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { productType: true },
    });

    let availableCount: number;
    if (product?.productType === PRODUCT_TYPE_ACCOUNT) {
      availableCount = await tx.account.count({
        where: { productId, status: KeyStatus.AVAILABLE },
      });
    } else {
      availableCount = await tx.key.count({
        where: { productId, status: KeyStatus.AVAILABLE },
      });
    }

    await tx.product.update({
      where: { id: productId },
      data: { stock: availableCount },
    });
  }

  async create(
    createOrderDto: CreateOrderDto,
    userId: string,
    couponData?: { couponId: string; discountAmount: number },
  ) {
    const { items } = createOrderDto;
    const requestedByProduct = new Map<string, number>();

    for (const item of items) {
      requestedByProduct.set(
        item.productId,
        (requestedByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }

    const productIds = items.map(i => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    let subtotal = 0;
    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      if (!product.isActive) {
        throw new BadRequestException(`Product ${product.name} is not active`);
      }

      const requestedQuantity = requestedByProduct.get(item.productId) ?? item.quantity;
      if (product.stock < requestedQuantity) {
        throw new BadRequestException(
          `Insufficient stock for product ${product.name}. ` +
            `Available: ${product.stock}, requested: ${requestedQuantity}`,
        );
      }

      subtotal += toNumber(product.price)! * item.quantity;
    }

    const discountAmount = couponData?.discountAmount ?? 0;
    const total = subtotal - discountAmount;

    const orderItems = items.flatMap(item =>
      Array.from({ length: item.quantity }, () => ({
        productId: item.productId,
        quantity: 1,
        price: productMap.get(item.productId)!.price,
      })),
    );

    const order = await this.prisma.order.create({
      data: {
        userId,
        status: OrderStatus.PENDING,
        subtotal,
        total,
        discountAmount,
        couponId: couponData?.couponId ?? null,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: { product: true },
        },
        payment: true,
        coupon: true,
      },
    });

    return {
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
              select: {
                id: true,
                status: true,
                deliveredAt: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            account: {
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

    return {
      ...order,
      total: toNumber(order.total),
      subtotal: toNumber(order.subtotal),
      discountAmount: toNumber(order.discountAmount),
      items: order.items.map(item => ({
        ...item,
        price: toNumber(item.price),
        product: item.product ? { ...item.product, price: toNumber(item.product.price) } : null,
        key: item.key ?? null,
        account: item.account ?? null,
      })),
      payment: order.payment ? { ...order.payment, amount: toNumber(order.payment.amount) } : null,
    };
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
                select: {
                  id: true,
                  status: true,
                  deliveredAt: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
              account: {
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
          account: item.account ?? null,
        })),
        payment: order.payment
          ? { ...order.payment, amount: toNumber(order.payment.amount) }
          : null,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          where: { OR: [{ keyId: { not: null } }, { accountId: { not: null } }] },
          select: { id: true, keyId: true, accountId: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

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

    if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) {
      const reservedKeyIds = order.items.flatMap(item => (item.keyId ? [item.keyId] : []));
      const reservedAccountIds = order.items.flatMap(item =>
        item.accountId ? [item.accountId] : [],
      );

      if (reservedKeyIds.length > 0) {
        await this.prisma.key.updateMany({
          where: { id: { in: reservedKeyIds } },
          data: { status: KeyStatus.AVAILABLE, orderItemId: null },
        });
      }

      if (reservedAccountIds.length > 0) {
        await this.prisma.account.updateMany({
          where: { id: { in: reservedAccountIds } },
          data: { status: KeyStatus.AVAILABLE, orderItemId: null },
        });
      }
    }

    return this.prisma.order
      .update({
        where: { id },
        data: { status },
        include: { items: true, payment: true },
      })
      .then(order => ({
        ...order,
        total: toNumber(order.total),
        subtotal: toNumber(order.subtotal),
        discountAmount: toNumber(order.discountAmount),
        items: order.items.map(item => ({ ...item, price: toNumber(item.price) })),
        payment: order.payment
          ? { ...order.payment, amount: toNumber(order.payment.amount) }
          : null,
      }));
  }

  async cancel(id: string) {
    return this.updateStatus(id, OrderStatus.CANCELLED);
  }

  async countByUser(userId: string) {
    return this.prisma.order.count({ where: { userId } });
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
              select: { id: true, status: true, deliveredAt: true },
            },
            account: {
              select: { id: true, status: true, deliveredAt: true },
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
        account: item.account ?? null,
      })),
    }));
  }

  async getProductsByIds(ids: string[]) {
    return this.prisma.product.findMany({ where: { id: { in: ids } } });
  }

  async reserveAvailableKey(productId: string, orderItemId: string) {
    const result = await this.prisma.key.updateMany({
      where: { productId, status: KeyStatus.AVAILABLE },
      data: { status: KeyStatus.RESERVED, orderItemId },
    });

    if (result.count === 0) return null;

    return this.prisma.key.findFirst({
      where: { orderItemId },
      include: { product: true },
    });
  }

  async reserveAvailableAccount(productId: string, orderItemId: string) {
    const availableAccount = await this.prisma.account.findFirst({
      where: { productId, status: KeyStatus.AVAILABLE },
    });

    if (!availableAccount) return null;

    const result = await this.prisma.account.updateMany({
      where: { id: availableAccount.id, status: KeyStatus.AVAILABLE },
      data: { status: KeyStatus.RESERVED, orderItemId },
    });

    if (result.count === 0) return null;

    return this.prisma.account.findFirst({
      where: { orderItemId },
      include: { product: true },
    });
  }

  async deliverKey(keyId: string) {
    const key = await this.prisma.key.update({
      where: { id: keyId },
      data: { status: KeyStatus.DELIVERED, deliveredAt: new Date() },
      include: { product: true, orderItem: true },
    });

    const decryptedKey = this.keysEncryption.decrypt(key.keyData);

    return { ...key, decryptedKey };
  }

  async deliverAccountData(accountId: string) {
    const account = await this.prisma.account.update({
      where: { id: accountId },
      data: { status: KeyStatus.DELIVERED, deliveredAt: new Date() },
      include: { product: true, orderItem: true },
    });

    return {
      ...account,
      decryptedEmail: this.keysEncryption.decrypt(account.email),
      decryptedPassword: this.keysEncryption.decrypt(account.password),
    };
  }

  async deliverOrderAtomic(orderId: string, items: ItemWithProduct[]) {
    const deliveredOrder = await this.prisma.$transaction(async tx => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.status !== OrderStatus.PAID) {
        throw new BadRequestException('Order must be in PAID status to deliver');
      }

      const affectedProductIds = new Set<string>();

      for (const item of items) {
        const productType = item.product?.productType ?? PRODUCT_TYPE_KEY;
        if (item.quantity !== 1) {
          throw new BadRequestException(
            `Order item ${item.id} must represent exactly one digital unit`,
          );
        }

        if (productType === PRODUCT_TYPE_ACCOUNT) {
          if (item.account) continue;

          const availableAccount = await tx.account.findFirst({
            where: { productId: item.productId, status: KeyStatus.AVAILABLE },
          });

          if (!availableAccount) {
            throw new BadRequestException(
              `No available accounts for product: ${item.product?.name ?? item.productId}`,
            );
          }

          const accountResult = await tx.account.updateMany({
            where: { id: availableAccount.id, status: KeyStatus.AVAILABLE },
            data: { status: KeyStatus.DELIVERED, deliveredAt: new Date(), orderItemId: item.id },
          });

          if (accountResult.count === 0) {
            throw new BadRequestException(
              `No available accounts for product: ${item.product?.name ?? item.productId}`,
            );
          }

          await tx.orderItem.update({
            where: { id: item.id },
            data: { accountId: availableAccount.id },
          });

          affectedProductIds.add(item.productId);
        } else {
          if (item.key) continue;

          const availableKey = await tx.key.findFirst({
            where: { productId: item.productId, status: KeyStatus.AVAILABLE },
          });

          if (!availableKey) {
            throw new BadRequestException(
              `No available keys for product: ${item.product?.name ?? item.productId}`,
            );
          }

          const keyResult = await tx.key.updateMany({
            where: { id: availableKey.id, status: KeyStatus.AVAILABLE },
            data: { status: KeyStatus.DELIVERED, deliveredAt: new Date(), orderItemId: item.id },
          });

          if (keyResult.count === 0) {
            throw new BadRequestException(
              `No available keys for product: ${item.product?.name ?? item.productId}`,
            );
          }

          await tx.orderItem.update({
            where: { id: item.id },
            data: { keyId: availableKey.id },
          });

          affectedProductIds.add(item.productId);
        }
      }

      for (const productId of affectedProductIds) {
        await this.syncProductStock(productId, tx);
      }

      const delivered = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.DELIVERED },
        include: { items: true, payment: true },
      });

      return {
        ...delivered,
        total: toNumber(delivered.total),
        subtotal: toNumber(delivered.subtotal),
        discountAmount: toNumber(delivered.discountAmount),
        items: delivered.items.map(item => ({ ...item, price: toNumber(item.price) })),
        payment: delivered.payment
          ? { ...delivered.payment, amount: toNumber(delivered.payment.amount) }
          : null,
      };
    });

    return deliveredOrder;
  }
}
