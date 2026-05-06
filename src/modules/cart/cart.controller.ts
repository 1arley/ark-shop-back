import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user cart' })
  @ApiResponse({ status: 200, description: 'Cart retrieved' })
  getCart(@CurrentUser() user: any) {
    return this.cartService.getCart(user.sub);
  }

  @Post('items')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiResponse({ status: 200, description: 'Item added' })
  addItem(@Body() dto: AddToCartDto, @CurrentUser() user: any) {
    return this.cartService.addItem(user.sub, dto);
  }

  @Patch('items/:productId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiResponse({ status: 200, description: 'Item updated' })
  updateItem(
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUser() user: any,
  ) {
    if (dto.quantity !== undefined) {
      return this.cartService.updateItem(user.sub, productId, dto.quantity);
    }
    return this.cartService.getCart(user.sub);
  }

  @Delete('items/:productId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse({ status: 200, description: 'Item removed' })
  removeItem(@Param('productId') productId: string, @CurrentUser() user: any) {
    return this.cartService.removeItem(user.sub, productId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear cart' })
  @ApiResponse({ status: 200, description: 'Cart cleared' })
  clearCart(@CurrentUser() user: any) {
    this.cartService.clearCart(user.sub);
    return { message: 'Cart cleared' };
  }

  @Get('count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get cart item count' })
  @ApiResponse({ status: 200, description: 'Count retrieved' })
  getCount(@CurrentUser() user: any) {
    return { count: this.cartService.getItemsCount(user.sub) };
  }
}
