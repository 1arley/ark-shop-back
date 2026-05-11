import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AddToCartDto } from './dto/cart.dto';
import { CartItem } from '@prisma/client';

type CartItemWithProduct = CartItem & {
  product: {
    id: string;
    name: string;
    price: number;
    isActive: boolean;
    stock: number;
    description: string | null;
  };
};

export interface CartResponse {
  items: CartItemWithProduct[];
  total: number;
  itemCount: number;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  // Ensure user has a cart, creating if necessary
  private async ensureCart(userId: string) {
    return this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: {
        items: {
          include: { cart: false },
        },
      },
    });
  }

  async getCart(userId: string): Promise<CartResponse> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            // Include product data to avoid N+1 query
            product: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!cart) {
      return { items: [], total: 0, itemCount: 0 };
    }

    // Use already included product data - no additional queries needed
    const itemsWithProducts = cart.items as unknown as CartItemWithProduct[];

    const total = itemsWithProducts.reduce((sum, item) => {
      const price = item.product?.price ? Number(item.product.price) : 0;
      return sum + price * item.quantity;
    }, 0);

    const itemCount = itemsWithProducts.reduce((sum, item) => sum + item.quantity, 0);

    return { items: itemsWithProducts, total, itemCount };
  }

  async addItem(userId: string, dto: AddToCartDto) {
    await this.ensureCart(userId);

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    const cart = await this.prisma.cart.findUnique({ where: { userId } });

    const existingItem = await this.prisma.cartItem.findFirst({
      where: { cartId: cart!.id, productId: dto.productId },
    });

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + dto.quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart!.id,
          productId: dto.productId,
          quantity: dto.quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(userId: string, productId: string, quantity: number) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const item = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId },
    });

    if (!item) {
      throw new NotFoundException('Item not found in cart');
    }

    if (quantity <= 0) {
      return this.removeItem(userId, productId);
    }

    await this.prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });

    if (!cart) {
      return { items: [], total: 0, itemCount: 0 };
    }

    const item = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId },
    });

    if (item) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
    }

    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });

    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    return { items: [], total: 0, itemCount: 0 };
  }

  async getItemsCount(userId: string): Promise<number> {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });

    if (!cart) return 0;

    const result = await this.prisma.cartItem.aggregate({
      where: { cartId: cart.id },
      _sum: { quantity: true },
    });

    return result._sum.quantity ?? 0;
  }
}
