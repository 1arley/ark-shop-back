import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/interfaces/request.interface';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createOrderDto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.create({
      ...createOrderDto,
      userId: user.id, // ← era user.sub (undefined)
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user orders' })
  @ApiResponse({ status: 200, description: 'List of orders' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
  ) {
    return this.ordersService.findByUser(user.id, page, limit); // ← era user.sub
  }

  @Get('recent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get recent orders (admin)' })
  @ApiResponse({ status: 200, description: 'List of recent orders' })
  findRecent(@Query('limit', ParseIntPipe) limit: number = 10) {
    return this.ordersService.getRecentOrders(limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your order' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const order = await this.ordersService.findById(id);

    if (
      order.user.id !== user.id && // ← era user.sub
      user.role !== 'ADMIN' &&
      user.role !== 'SUPERADMIN'
    ) {
      throw new ForbiddenException('You can only view your own orders');
    }

    return order;
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order status (admin)' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.ordersService.updateStatus(id, status as any);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel order' })
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const order = await this.ordersService.findById(id);

    if (order.user.id !== user.id) {
      // ← era user.sub
      throw new ForbiddenException('You can only cancel your own orders');
    }

    return this.ordersService.cancel(id);
  }

  @Post(':id/deliver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deliver order keys (admin)' })
  @ApiResponse({ status: 200, description: 'Order delivered' })
  @ApiResponse({ status: 400, description: 'Cannot deliver order' })
  deliver(@Param('id') id: string) {
    return this.ordersService.deliverOrder(id);
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download order keys (customer)' })
  @ApiResponse({ status: 200, description: 'Keys downloaded' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your order' })
  @ApiResponse({ status: 400, description: 'Order not delivered yet' })
  downloadKeys(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.downloadKeys(id, user.id); // ← era user.sub
  }
}
