import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AntifraudService } from './antifraud.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';

@ApiTags('antifraud')
@Controller('antifraud')
export class AntifraudController {
  constructor(private readonly antifraudService: AntifraudService) {}

  @Get('logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get fraud logs (admin)' })
  @ApiResponse({ status: 200, description: 'List of fraud logs' })
  getFraudLogs(@Query('limit', ParseIntPipe) limit: number = 100) {
    return this.antifraudService.getFraudLogs(limit);
  }
}
