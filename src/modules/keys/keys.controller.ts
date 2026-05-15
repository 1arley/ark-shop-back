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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { KeysService } from './keys.service';
import { UpdateKeyDto } from './dto/update-key.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';

@ApiTags('keys')
@Controller('keys')
export class KeysController {
  constructor(private readonly keysService: KeysService) {}

  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import keys for a product' })
  @ApiResponse({ status: 201, description: 'Keys imported successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  importKeys(@Body('productId') productId: string, @Body('keys') keys: string[]) {
    return this.keysService.importKeys(productId, keys);
  }

  @Get('product/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get keys for a product' })
  @ApiResponse({ status: 200, description: 'List of keys' })
  getProductKeys(
    @Param('productId') productId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.keysService.getProductKeys(productId, page, limit);
  }

  @Get('stats/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get key statistics for a product' })
  @ApiResponse({ status: 200, description: 'Key statistics' })
  getKeyStats(@Param('productId') productId: string) {
    return this.keysService.getKeyStats(productId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get key by ID' })
  @ApiResponse({ status: 200, description: 'Key found' })
  @ApiResponse({ status: 404, description: 'Key not found' })
  getKey(@Param('id') id: string) {
    return this.keysService.getKey(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a key' })
  @ApiResponse({ status: 200, description: 'Key updated' })
  @ApiResponse({ status: 404, description: 'Key not found' })
  updateKey(@Param('id') id: string, @Body() dto: UpdateKeyDto) {
    return this.keysService.updateKey(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a key' })
  @ApiResponse({ status: 200, description: 'Key deleted' })
  @ApiResponse({ status: 404, description: 'Key not found' })
  deleteKey(@Param('id') id: string) {
    return this.keysService.deleteKey(id);
  }

  @Post('generate-demo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate demo keys for testing' })
  @ApiResponse({ status: 201, description: 'Demo keys generated' })
  generateDemoKeys(
    @Body('productId') productId: string,
    @Body('quantity', ParseIntPipe) quantity: number = 10,
  ) {
    return this.keysService.generateDemoKeys(productId, quantity);
  }
}
