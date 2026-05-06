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
import { PaymentsService } from './payments.service';
import { PaymentProvider, PaymentMethod } from '@prisma/client';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment for order' })
  @ApiResponse({ status: 201, description: 'Payment created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  createPayment(
    @Param('orderId') orderId: string,
    @Body('amount') amount: number,
    @Body('provider') provider?: PaymentProvider,
    @Body('method') method: PaymentMethod = PaymentMethod.PIX,
  ) {
    return this.paymentsService.createPayment(orderId, 'user-id', amount, provider, method);
  }

  @Post('webhook/:provider')
  @ApiOperation({ summary: 'Payment webhook handler' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async webhook(
    @Param('provider') provider: string,
    @Body() webhookData: any,
  ) {
    // In production, validate webhook signature
    console.log(`Webhook received from ${provider}:`, webhookData);
    
    // Process webhook based on provider
    return { received: true };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment found' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  getPayment(@Param('id') id: string) {
    return this.paymentsService.getPayment(id);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment by order ID' })
  @ApiResponse({ status: 200, description: 'Payment found' })
  getPaymentByOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentByOrderId(orderId);
  }

  @Post(':id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refund payment' })
  @ApiResponse({ status: 200, description: 'Payment refunded' })
  @ApiResponse({ status: 400, description: 'Cannot refund' })
  refundPayment(
    @Param('id') id: string,
    @Body('amount') amount?: number,
  ) {
    return this.paymentsService.refundPayment(id, amount);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user payments (admin)' })
  @ApiResponse({ status: 200, description: 'List of payments' })
  getUserPayments(
    @Param('userId') userId: string,
    @Query('page', ParseIntPipe) page: number = 1,
    @Query('limit', ParseIntPipe) limit: number = 10,
  ) {
    return this.paymentsService.getUserPayments(userId, page, limit);
  }
}
