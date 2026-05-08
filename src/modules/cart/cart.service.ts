import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AddToCartDto } from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  // Garante que o usuário tem um cart, criando se necessário
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

  async getCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            // inclui dados básicos do produto para exibição no frontend
            cart: false,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Busca produtos separadamente para não complicar a query
    if (!cart) {
      return { items: [], total: 0, itemCount: 0 };
    }

    // Enriquece os itens com dados do produto
    const itemsWithProducts = await Promise.all(
      cart.items.map(async item => {
        const product = await this.prisma.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            price: true,
            isActive: true,
            stock: true,
            description: true,
          },
        });
        return { ...item, product };
      }),
    );

    const total = itemsWithProducts.reduce((sum, item) => {
      const price = item.product?.price?.toNumber() ?? 0;
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
