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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

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
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: any,
  ) {
    // User can only create orders for themselves
    return this.ordersService.create({
      ...createOrderDto,
      userId: user.sub,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user orders' })
  @ApiResponse({ status: 200, description: 'List of orders' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @CurrentUser() user: any,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
  ) {
    // Users can only see their own orders
    return this.ordersService.findByUser(user.sub, page, limit);
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
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    // Users can only view their own orders
    const order = await this.ordersService.findById(id);

    // Check ownership (unless admin)
    if (
      order.user.id !== user.sub &&
      user.role !== 'ADMIN' &&
      user.role !== 'SUPERADMIN'
    ) {
      throw new Error('Forbidden: You can only view your own orders');
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
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    const order = await this.ordersService.findById(id);

    // Users can only cancel their own orders
    if (order.user.id !== user.sub) {
      throw new Error('Forbidden: You can only cancel your own orders');
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
  async deliver(@Param('id') id: string) {
    return this.ordersService.deliverOrder(id);
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download order keys (customer)' })
  @ApiResponse({ status: 200, description: 'Keys downloaded' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your order' })
  @ApiResponse({ status: 400, description: 'Order not delivered yet' })
  async downloadKeys(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.downloadKeys(id, user.sub);
  }
}
