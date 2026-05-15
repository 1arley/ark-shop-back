import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ImportProductsDto } from './dto/import-products.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('import')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // ✅ Rate limiting: 5 req/min (CRÍTICO: Previne DoS)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Import products from CSV',
    description:
      'Import products from a CSV file exported from Google Sheets. Accepts either JSON body with csvContent string OR multipart/form-data file upload. The CSV should have columns for each platform (XBOX, STEAM/PC, NINTENDO E-SHOP, PLAYSTATION) with sub-columns: timestamp, game name, price.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            csvContent: {
              type: 'string',
              example: `XBOX,STEAM/PC,NINTENDO E-SHOP,PLAYSTATION
Carimbo de data/hora,Nome do jogo,preço de venda,Carimbo de data/hora,Nome do jogo,preço de venda
07/12/2025 15:01:53,Final fantasy xvi(xbox-europa),R$200,00,17/12/2025 21:49:01,cuphead(steam-global),R$100,00`,
            },
            categoryId: { type: 'string', example: 'uuid-here' },
            isActive: { type: 'boolean', example: true },
          },
          required: ['csvContent'],
        },
        {
          type: 'object',
          properties: {
            file: { type: 'string', format: 'binary' },
            categoryId: { type: 'string', example: 'uuid-here' },
            isActive: { type: 'boolean', example: true },
          },
          required: ['file'],
        },
      ],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Products imported successfully',
    schema: {
      type: 'object',
      properties: {
        imported: { type: 'number', example: 10 },
        failed: { type: 'number', example: 0 },
        products: { type: 'array' },
        errors: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid CSV format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async importFromCsv(
    @Body() body: ImportProductsDto & { categoryId?: string; isActive?: boolean },
  ) {
    if (!body.csvContent) {
      throw new BadRequestException('CSV content is required');
    }
    return this.productsService.importFromCsv(body.csvContent, {
      categoryId: body.categoryId,
      isActive: body.isActive,
    });
  }

  @Post('import/file')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Import products from CSV file upload',
    description:
      'Upload a CSV file to import products. The CSV should be in Google Sheets export format with columns for each platform (XBOX, STEAM/PC, NINTENDO E-SHOP, PLAYSTATION) with sub-columns: timestamp, game name, price.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'CSV file to import' },
        categoryId: { type: 'string', example: 'uuid-here' },
        isActive: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Products imported successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid CSV file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async importFromCsvFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { categoryId?: string; isActive?: boolean },
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are allowed');
    }

    const csvContent = file.buffer.toString('utf-8');

    if (!csvContent || csvContent.trim().length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    return this.productsService.importFromCsv(csvContent, {
      categoryId: body.categoryId,
      isActive: body.isActive,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, description: 'List of products' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: String,
    description: 'Filter by active status (true/false)',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by name or description',
  })
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('isActive') isActive?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    const filters = {
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      categoryId,
      search,
    };
    return this.productsService.findAll(page, limit, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 200, description: 'Product found' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete product' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  remove(@Param('id') id: string) {
    return this.productsService.delete(id);
  }
}
