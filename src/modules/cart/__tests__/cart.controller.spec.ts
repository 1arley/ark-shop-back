import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from '../cart.controller';
import { CartService } from '../cart.service';

describe('CartController', () => {
  let controller: CartController;
  let cartService: CartService;

  const mockUser = {
    id: 'user-id-1',
    email: 'test@test.com',
    name: 'Test User',
    role: 'USER' as const,
    emailVerified: false,
  };

  const mockCartResult = {
    id: 'cart-id-1',
    userId: 'user-id-1',
    items: [],
    total: 0,
    itemCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCartService = {
    getCart: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    clearCart: jest.fn(),
    getItemsCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: mockCartService }],
    }).compile();

    controller = module.get<CartController>(CartController);
    cartService = module.get<CartService>(CartService);

    jest.clearAllMocks();
  });

  // ─── getCart ──────────────────────────────────────────────────────
  describe('getCart', () => {
    it('deve retornar carrinho do usuario com sucesso', async () => {
      mockCartService.getCart.mockResolvedValue(mockCartResult);

      const result = await controller.getCart(mockUser);

      expect(cartService.getCart).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockCartResult);
    });
  });

  // ─── addItem ──────────────────────────────────────────────────────
  describe('addItem', () => {
    it('deve adicionar item ao carrinho com sucesso', async () => {
      const dto = { productId: 'product-id-1', quantity: 2 };
      const cartWithItem = {
        ...mockCartResult,
        items: [{ id: 'item-1', productId: 'product-id-1', quantity: 2 }],
        total: 200,
        itemCount: 2,
      };
      mockCartService.addItem.mockResolvedValue(cartWithItem);

      const result = await controller.addItem(dto, mockUser);

      expect(cartService.addItem).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toEqual(cartWithItem);
    });
  });

  // ─── updateItem ───────────────────────────────────────────────────
  describe('updateItem', () => {
    it('deve atualizar quantidade do item com sucesso', async () => {
      const dto = { quantity: 5 };
      const updatedCart = {
        ...mockCartResult,
        items: [{ id: 'item-1', productId: 'product-id-1', quantity: 5 }],
        total: 500,
        itemCount: 5,
      };
      mockCartService.updateItem.mockResolvedValue(updatedCart);

      const result = await controller.updateItem('product-id-1', dto, mockUser);

      expect(cartService.updateItem).toHaveBeenCalledWith(mockUser.id, 'product-id-1', 5);
      expect(result).toEqual(updatedCart);
    });

    it('deve retornar carrinho quando quantidade nao e fornecida', async () => {
      const dto = {};
      mockCartService.getCart.mockResolvedValue(mockCartResult);

      const result = await controller.updateItem('product-id-1', dto as any, mockUser);

      expect(cartService.updateItem).not.toHaveBeenCalled();
      expect(cartService.getCart).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockCartResult);
    });
  });

  // ─── removeItem ───────────────────────────────────────────────────
  describe('removeItem', () => {
    it('deve remover item do carrinho com sucesso', async () => {
      const emptyCart = {
        ...mockCartResult,
        items: [],
        total: 0,
        itemCount: 0,
      };
      mockCartService.removeItem.mockResolvedValue(emptyCart);

      const result = await controller.removeItem('product-id-1', mockUser);

      expect(cartService.removeItem).toHaveBeenCalledWith(mockUser.id, 'product-id-1');
      expect(result).toEqual(emptyCart);
    });
  });

  // ─── clearCart ────────────────────────────────────────────────────
  describe('clearCart', () => {
    it('deve limpar carrinho com sucesso', async () => {
      const emptyCart = {
        items: [],
        total: 0,
        itemCount: 0,
      };
      mockCartService.clearCart.mockResolvedValue(emptyCart);

      const result = await controller.clearCart(mockUser);

      expect(cartService.clearCart).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(emptyCart);
    });
  });

  // ─── getCount ─────────────────────────────────────────────────────
  describe('getCount', () => {
    it('deve retornar contagem de itens com sucesso', async () => {
      mockCartService.getItemsCount.mockResolvedValue(5);

      const result = await controller.getCount(mockUser);

      expect(cartService.getItemsCount).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({ count: 5 });
    });

    it('deve retornar count 0 quando carrinho esta vazio', async () => {
      mockCartService.getItemsCount.mockResolvedValue(0);

      const result = await controller.getCount(mockUser);

      expect(result).toEqual({ count: 0 });
    });
  });
});
