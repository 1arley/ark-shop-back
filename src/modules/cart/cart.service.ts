import { Injectable } from '@nestjs/common';
import { CartItemDto } from './dto/cart.dto';

export interface CartItem extends CartItemDto {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  stock: number;
  isActive: boolean;
}

export interface Cart {
  items: CartItem[];
  total: number;
  itemCount: number;
}

@Injectable()
export class CartService {
  private carts: Map<string, CartItem[]> = new Map();

  getCart(userId: string): Cart {
    const items = this.carts.get(userId) || [];
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items,
      total,
      itemCount,
    };
  }

  addItem(userId: string, item: CartItemDto): Cart {
    const items = this.carts.get(userId) || [];
    const existingItem = items.find((i) => i.productId === item.productId);

    if (existingItem) {
      existingItem.quantity += item.quantity;
    } else {
      items.push({
        ...item,
        id: item.productId,
        name: '',
        price: 0,
        stock: 0,
        isActive: true,
      });
    }

    this.carts.set(userId, items);
    return this.getCart(userId);
  }

  updateItem(userId: string, productId: string, quantity: number): Cart {
    const items = this.carts.get(userId) || [];
    const item = items.find((i) => i.productId === productId);

    if (item) {
      if (quantity <= 0) {
        this.removeItem(userId, productId);
      } else {
        item.quantity = quantity;
        this.carts.set(userId, items);
      }
    }

    return this.getCart(userId);
  }

  removeItem(userId: string, productId: string): Cart {
    const items = this.carts.get(userId) || [];
    const filteredItems = items.filter((i) => i.productId !== productId);
    this.carts.set(userId, filteredItems);
    return this.getCart(userId);
  }

  clearCart(userId: string): void {
    this.carts.delete(userId);
  }

  getItemsCount(userId: string): number {
    const items = this.carts.get(userId) || [];
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }
}
