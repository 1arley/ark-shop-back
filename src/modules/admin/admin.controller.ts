import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  ParseBoolPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';
import { GenerateDemoDataDto } from './admin.dto';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard stats' })
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all users (admin)' })
  @ApiResponse({ status: 200, description: 'List of users' })
  getUsers(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    return this.adminService.getAllUsers(page, limit);
  }

  @Get('fraud-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get fraud logs (admin)' })
  @ApiResponse({ status: 200, description: 'List of fraud logs' })
  getFraudLogs(
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 20,
  ) {
    return this.adminService.getFraudLogs(page, limit);
  }

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'System health check' })
  @ApiResponse({ status: 200, description: 'System health' })
  health() {
    return this.adminService.getSystemHealth();
  }

  @Post('keys/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate demo data' })
  @ApiResponse({ status: 201, description: 'Demo data generated' })
  generateDemo(@Body() dto: GenerateDemoDataDto = new GenerateDemoDataDto()) {
    return this.adminService.generateDemoData(dto.productsCount, dto.keysPerProduct);
  }

  @Post('clear-demo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Clear all demo data (DANGER)' })
  @ApiResponse({ status: 200, description: 'Demo data cleared' })
  clearDemo() {
    return this.adminService.clearDemoData();
  }
}
