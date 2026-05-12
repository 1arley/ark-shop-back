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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SellersService } from './sellers.service';
import { CreateSellerDto, UpdateSellerDto } from './dto/create-seller.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';

@ApiTags('sellers')
@Controller('sellers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPERADMIN')
@ApiBearerAuth()
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a seller' })
  @ApiResponse({ status: 201, description: 'Seller created' })
  @ApiResponse({ status: 409, description: 'User already has a seller profile' })
  create(@Body() dto: CreateSellerDto) {
    return this.sellersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all sellers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated sellers' })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.sellersService.findAll(page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get seller by ID' })
  @ApiResponse({ status: 200, description: 'Seller found' })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  findOne(@Param('id') id: string) {
    return this.sellersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update seller' })
  @ApiResponse({ status: 200, description: 'Seller updated' })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  update(@Param('id') id: string, @Body() dto: UpdateSellerDto) {
    return this.sellersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete seller' })
  @ApiResponse({ status: 200, description: 'Seller deleted' })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  remove(@Param('id') id: string) {
    return this.sellersService.delete(id);
  }
}
