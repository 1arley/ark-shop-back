import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  ParseBoolPipe,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';
import { GenerateDemoDataDto } from './admin.dto';
import {
  AdminCreateProductDto,
  AdminUpdateProductDto,
  AddKeysDto,
  UpdateOrderStatusDto,
} from './dto/admin-product.dto';

const ADMIN_ROLES = ['ADMIN', 'SUPERADMIN'];

function AdminGuard() {
  return [JwtAuthGuard, RolesGuard];
}

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard stats' })
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (admin)' })
  @ApiResponse({ status: 200, description: 'List of users' })
  getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getAllUsers(page, limit);
  }

  @Get('fraud-logs')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get fraud logs (admin)' })
  @ApiResponse({ status: 200, description: 'List of fraud logs' })
  getFraudLogs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getFraudLogs(page, limit);
  }

  @Get('health')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'System health check' })
  @ApiResponse({ status: 200, description: 'System health' })
  health() {
    return this.adminService.getSystemHealth();
  }

  // ─── Products ─────────────────────────────────────────────

  @Get('products')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all products (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated products' })
  findAllProducts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.findAllProducts(page, limit, search);
  }

  @Post('products')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product (admin)' })
  @ApiResponse({ status: 201, description: 'Product created' })
  createProduct(@Body() dto: AdminCreateProductDto) {
    return this.adminService.createProduct(dto);
  }

  @Patch('products/:id')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product (admin)' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  updateProduct(@Param('id') id: string, @Body() dto: AdminUpdateProductDto) {
    return this.adminService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product (admin)' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @ApiResponse({ status: 409, description: 'Product has associated orders' })
  deleteProduct(@Param('id') id: string) {
    return this.adminService.deleteProduct(id);
  }

  @Post('products/:id/keys')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add keys to a product (admin)' })
  @ApiResponse({ status: 201, description: 'Keys added' })
  addKeys(@Param('id') productId: string, @Body() dto: AddKeysDto) {
    return this.adminService.addKeysToProduct(productId, dto.keys);
  }

  // ─── Orders ───────────────────────────────────────────────

  @Get('orders')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all orders (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated orders' })
  findAllOrders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.findAllOrders(page, limit, status);
  }

  @Patch('orders/:id/status')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order status (admin)' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  updateOrderStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.adminService.updateOrderStatus(id, dto.status);
  }

  // ─── Keys ─────────────────────────────────────────────────

  @Get('keys')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List key inventory (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'productId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated keys' })
  findAllKeys(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('productId') productId?: string,
  ) {
    return this.adminService.findAllKeys(page, limit, productId);
  }

  @Post('keys/import')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk import keys' })
  @ApiResponse({ status: 201, description: 'Keys imported' })
  async importKeys(
    @Body('productId') productId: string,
    @Body('keysText') keysText: string,
    @Body('isCsv', ParseBoolPipe) isCsv: boolean = false,
  ) {
    return this.adminService.bulkImportKeys(productId, keysText, isCsv);
  }

  @Post('generate-demo')
  @UseGuards(...AdminGuard())
  @Roles(...ADMIN_ROLES)
  @ApiBearerAuth()
  @SkipThrottle()
  @ApiOperation({ summary: 'Generate demo data' })
  @ApiResponse({ status: 201, description: 'Demo data generated' })
  generateDemo(@Body() dto: GenerateDemoDataDto = new GenerateDemoDataDto()) {
    return this.adminService.generateDemoData(dto.productsCount, dto.keysPerProduct);
  }

  @Post('clear-demo')
  @UseGuards(...AdminGuard())
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear all demo data (DANGER)' })
  @ApiResponse({ status: 200, description: 'Demo data cleared' })
  clearDemo(@Body('confirmationToken') confirmationToken: string) {
    return this.adminService.clearDemoData(confirmationToken);
  }
}
