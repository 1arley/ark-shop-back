import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CartService } from '../cart.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('CartService', () => {
  let service: CartService;
  let prisma: PrismaService;

  const mockPrismaService = {
    cart: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    cartItem: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      aggregate: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCart = {
    id: 'cart-id-1',
    userId: 'user-id-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCartItem = {
    id: 'cart-item-id-1',
    cartId: 'cart-id-1',
    productId: 'product-id-1',
    quantity: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProduct = {
    id: 'product-id-1',
    name: 'Game Key',
    price: 100,
    isActive: true,
    stock: 10,
    description: 'A game key',
    imageUrl: 'http://img.com/game.jpg',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CartService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<CartService>(CartService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  // ─── getCart ──────────────────────────────────────────────────────
  describe('getCart', () => {
    it('deve retornar carrinho com itens e produtos', async () => {
      const cartWithItems = {
        ...mockCart,
        items: [mockCartItem],
      };

      mockPrismaService.cart.findUnique.mockResolvedValue(cartWithItems);
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.getCart('user-id-1');

      expect(prisma.cart.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-id-1' },
        include: {
          items: {
            include: { cart: false },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['product-id-1'] } },
        select: {
          id: true,
          name: true,
          price: true,
          isActive: true,
          stock: true,
          description: true,
          imageUrl: true,
        },
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.product).toEqual(mockProduct);
      expect(result.total).toBe(100);
      expect(result.itemCount).toBe(1);
      expect(result.id).toBe('cart-id-1');
      expect(result.userId).toBe('user-id-1');
    });

    it('deve retornar carrinho vazio quando nao existe carrinho', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(null);

      const result = await service.getCart('user-id-1');

      expect(result).toEqual({ items: [], total: 0, itemCount: 0 });
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('deve retornar carrinho vazio quando carrinho nao tem itens', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [],
      });

      const result = await service.getCart('user-id-1');

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.itemCount).toBe(0);
    });

    it('deve calcular total corretamente com multiplos itens', async () => {
      const product1 = { ...mockProduct, id: 'prod-1', price: 100 };
      const item1 = { ...mockCartItem, id: 'item-1', productId: 'prod-1', quantity: 2 };
      const item2 = { ...mockCartItem, id: 'item-2', productId: 'prod-2', quantity: 3 };
      const product2 = { ...mockProduct, id: 'prod-2', price: 50 };

      mockPrismaService.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [item1, item2],
      });
      mockPrismaService.product.findMany.mockResolvedValue([product1, product2]);

      const result = await service.getCart('user-id-1');

      // 2 * 100 + 3 * 50 = 350
      expect(result.total).toBe(350);
      expect(result.itemCount).toBe(5);
    });

    it('deve tratar produto null quando nao encontrado no batch fetch', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue({
        ...mockCart,
        items: [mockCartItem],
      });
      mockPrismaService.product.findMany.mockResolvedValue([]);

      const result = await service.getCart('user-id-1');

      expect(result.items[0]!.product).toBeNull();
      expect(result.total).toBe(0);
    });
  });

  // ─── addItem ──────────────────────────────────────────────────────
  describe('addItem', () => {
    it('deve adicionar novo item ao carrinho', async () => {
      const dto = { productId: 'product-id-1', quantity: 1 };

      mockPrismaService.cart.upsert.mockResolvedValue(mockCart);
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);

      const mockTx = {
        cartItem: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(mockCartItem),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async cb => cb(mockTx));
      mockPrismaService.cart.findUnique
        .mockResolvedValueOnce({ ...mockCart, items: [] }) // addItem: get cart
        .mockResolvedValue({ ...mockCart, items: [mockCartItem] }); // getCart: get cart with items
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.addItem('user-id-1', dto);

      expect(prisma.cart.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-id-1' },
        create: { userId: 'user-id-1' },
        update: {},
      });
      expect(mockTx.cartItem.create).toHaveBeenCalledWith({
        data: {
          cartId: 'cart-id-1',
          productId: 'product-id-1',
          quantity: 1,
        },
      });
      expect(result.items).toHaveLength(1);
    });

    it('deve incrementar quantidade quando item ja existe', async () => {
      const dto = { productId: 'product-id-1', quantity: 2 };
      const existingItem = { ...mockCartItem, quantity: 3 };

      mockPrismaService.cart.upsert.mockResolvedValue(mockCart);
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);

      const mockTx = {
        cartItem: {
          findFirst: jest.fn().mockResolvedValue(existingItem),
          update: jest.fn().mockResolvedValue({ ...existingItem, quantity: 5 }),
        },
      };
      mockPrismaService.$transaction.mockImplementation(async cb => cb(mockTx));
      mockPrismaService.cart.findUnique
        .mockResolvedValueOnce(mockCart)
        .mockResolvedValue({ ...mockCart, items: [{ ...existingItem, quantity: 5 }] });
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.addItem('user-id-1', dto);

      expect(mockTx.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'cart-item-id-1' },
        data: { quantity: 5 }, // 3 + 2
      });
      expect(result.items[0]!.quantity).toBe(5);
    });

    it('deve lancar NotFoundException quando produto nao existe', async () => {
      const dto = { productId: 'nonexistent', quantity: 1 };

      mockPrismaService.cart.upsert.mockResolvedValue(mockCart);
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.addItem('user-id-1', dto)).rejects.toThrow(NotFoundException);
      await expect(service.addItem('user-id-1', dto)).rejects.toThrow(
        'Product nonexistent not found',
      );
      expect(prisma.cartItem.create).not.toHaveBeenCalled();
    });
  });

  // ─── updateItem ───────────────────────────────────────────────────
  describe('updateItem', () => {
    it('deve atualizar quantidade do item', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.findFirst.mockResolvedValue(mockCartItem);
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.cartItem.update.mockResolvedValue({ ...mockCartItem, quantity: 5 });
      mockPrismaService.cart.findUnique
        .mockResolvedValueOnce(mockCart)
        .mockResolvedValue({ ...mockCart, items: [{ ...mockCartItem, quantity: 5 }] });
      mockPrismaService.product.findMany.mockResolvedValue([mockProduct]);

      const result = await service.updateItem('user-id-1', 'product-id-1', 5);

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'cart-item-id-1' },
        data: { quantity: 5 },
      });
      expect(result.items[0]!.quantity).toBe(5);
    });

    it('deve remover item quando quantidade <= 0', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.findFirst.mockResolvedValue(mockCartItem);
      mockPrismaService.cartItem.delete.mockResolvedValue(mockCartItem);
      mockPrismaService.cart.findUnique.mockResolvedValue({ ...mockCart, items: [] });

      const result = await service.updateItem('user-id-1', 'product-id-1', 0);

      expect(prisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'cart-item-id-1' },
      });
      expect(result.items).toEqual([]);
    });

    it('deve remover item quando quantidade e negativa', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.findFirst.mockResolvedValue(mockCartItem);
      mockPrismaService.cartItem.delete.mockResolvedValue(mockCartItem);
      mockPrismaService.cart.findUnique.mockResolvedValue({ ...mockCart, items: [] });

      const result = await service.updateItem('user-id-1', 'product-id-1', -1);

      expect(prisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'cart-item-id-1' },
      });
      expect(result.items).toEqual([]);
    });

    it('deve lancar NotFoundException quando item nao existe no carrinho', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.findFirst.mockResolvedValue(null);

      await expect(service.updateItem('user-id-1', 'nonexistent-product', 5)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.updateItem('user-id-1', 'nonexistent-product', 5)).rejects.toThrow(
        'Item not found in cart',
      );
    });

    it('deve lancar NotFoundException quando carrinho nao existe', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(null);

      await expect(service.updateItem('user-id-1', 'product-id-1', 5)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.updateItem('user-id-1', 'product-id-1', 5)).rejects.toThrow(
        'Cart not found',
      );
    });

    it('deve lancar BadRequestException quando quantidade excede estoque', async () => {
      const lowStockProduct = { ...mockProduct, stock: 2 };

      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.findFirst.mockResolvedValue(mockCartItem);
      mockPrismaService.product.findUnique.mockResolvedValue(lowStockProduct);

      await expect(service.updateItem('user-id-1', 'product-id-1', 10)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── removeItem ───────────────────────────────────────────────────
  describe('removeItem', () => {
    it('deve remover item do carrinho', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.findFirst.mockResolvedValue(mockCartItem);
      mockPrismaService.cartItem.delete.mockResolvedValue(mockCartItem);
      mockPrismaService.cart.findUnique
        .mockResolvedValueOnce(mockCart)
        .mockResolvedValue({ ...mockCart, items: [] });

      const result = await service.removeItem('user-id-1', 'product-id-1');

      expect(prisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'cart-item-id-1' },
      });
      expect(result.items).toEqual([]);
    });

    it('deve retornar carrinho vazio quando item nao existe', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.findFirst.mockResolvedValue(null);
      mockPrismaService.cart.findUnique
        .mockResolvedValueOnce(mockCart)
        .mockResolvedValue({ ...mockCart, items: [] });

      const result = await service.removeItem('user-id-1', 'nonexistent-product');

      expect(prisma.cartItem.delete).not.toHaveBeenCalled();
      expect(result.items).toEqual([]);
    });

    it('deve retornar carrinho vazio quando carrinho nao existe', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(null);

      const result = await service.removeItem('user-id-1', 'product-id-1');

      expect(result).toEqual({ items: [], total: 0, itemCount: 0 });
      expect(prisma.cartItem.findFirst).not.toHaveBeenCalled();
    });
  });

  // ─── clearCart ────────────────────────────────────────────────────
  describe('clearCart', () => {
    it('deve limpar carrinho com itens', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);

      const result = await service.clearCart('user-id-1');

      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-id-1' },
      });
      expect(result).toEqual({ items: [], total: 0, itemCount: 0 });
    });

    it('deve retornar carrinho vazio quando carrinho nao existe', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(null);

      const result = await service.clearCart('user-id-1');

      expect(prisma.cartItem.deleteMany).not.toHaveBeenCalled();
      expect(result).toEqual({ items: [], total: 0, itemCount: 0 });
    });
  });

  // ─── getItemsCount ────────────────────────────────────────────────
  describe('getItemsCount', () => {
    it('deve retornar contagem de itens quando carrinho existe', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.aggregate.mockResolvedValue({
        _sum: { quantity: 5 },
      });

      const result = await service.getItemsCount('user-id-1');

      expect(prisma.cart.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-id-1' },
      });
      expect(prisma.cartItem.aggregate).toHaveBeenCalledWith({
        where: { cartId: 'cart-id-1' },
        _sum: { quantity: true },
      });
      expect(result).toBe(5);
    });

    it('deve retornar 0 quando carrinho nao existe', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(null);

      const result = await service.getItemsCount('user-id-1');

      expect(result).toBe(0);
      expect(prisma.cartItem.aggregate).not.toHaveBeenCalled();
    });

    it('deve retornar 0 quando aggregate retorna null', async () => {
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.aggregate.mockResolvedValue({
        _sum: { quantity: null },
      });

      const result = await service.getItemsCount('user-id-1');

      expect(result).toBe(0);
    });
  });
});
