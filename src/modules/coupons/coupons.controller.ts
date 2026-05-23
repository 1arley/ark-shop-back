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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // ─── Public endpoint (for cart checkout) ───────────────────────

  @Post('validate')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate a coupon and calculate discount' })
  @ApiResponse({ status: 200, description: 'Coupon validation result' })
  @ApiResponse({ status: 400, description: 'Invalid or expired coupon' })
  validateCoupon(@Body() dto: ApplyCouponDto) {
    return this.couponsService.validateAndCalculate(dto);
  }

  // ─── Admin endpoints ───────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new coupon (admin)' })
  @ApiResponse({ status: 201, description: 'Coupon created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Coupon code already exists' })
  create(@Body() createCouponDto: CreateCouponDto) {
    return this.couponsService.create(createCouponDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all coupons (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated coupons' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.couponsService.findAll(page, limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get coupon by ID (admin)' })
  @ApiResponse({ status: 200, description: 'Coupon found' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a coupon (admin)' })
  @ApiResponse({ status: 200, description: 'Coupon updated' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateCouponDto: UpdateCouponDto) {
    return this.couponsService.update(id, updateCouponDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a coupon (admin)' })
  @ApiResponse({ status: 200, description: 'Coupon deleted' })
  @ApiResponse({ status: 404, description: 'Coupon not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponsService.delete(id);
  }
}
