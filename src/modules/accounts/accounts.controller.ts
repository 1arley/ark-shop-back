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
import { AccountsService } from './accounts.service';
import { ImportAccountsDto } from './dto/import-accounts.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import accounts for a product' })
  @ApiResponse({ status: 201, description: 'Accounts imported successfully' })
  async importAccounts(@Body() dto: ImportAccountsDto) {
    return this.accountsService.importAccounts(dto.productId, dto.accounts);
  }

  @Get('product/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get accounts for a product' })
  getProductAccounts(
    @Param('productId') productId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.accountsService.getProductAccounts(productId, page, limit);
  }

  @Get('stats/:productId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get account statistics for a product' })
  getAccountStats(@Param('productId') productId: string) {
    return this.accountsService.getAccountStats(productId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get account by ID' })
  @ApiResponse({ status: 200, description: 'Account found' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  getAccount(@Param('id') id: string) {
    return this.accountsService.getAccount(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an account' })
  updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    const data: any = { ...dto };
    if (dto.metadata) {
      try {
        data.metadata = JSON.parse(dto.metadata);
      } catch {
        data.metadata = dto.metadata;
      }
    }
    return this.accountsService.updateAccount(id, data);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an account' })
  deleteAccount(@Param('id') id: string) {
    return this.accountsService.deleteAccount(id);
  }
}
