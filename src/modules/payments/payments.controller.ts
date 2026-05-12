import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { RolesGuard } from '@/auth/roles.guard';
import { Roles } from '@/auth/roles.decorators';
import { MercadoPagoWebhookHandler } from './webhooks/mercado-pago-webhook.handler';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RawBody } from '@/common/decorators/raw-body.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly mpWebhookHandler: MercadoPagoWebhookHandler,
  ) {}

  @Post(':orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment for order' })
  @ApiResponse({ status: 201, description: 'Payment created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  createPayment(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() createPaymentDto: CreatePaymentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.paymentsService.createPayment(
      orderId,
      user.id,
      createPaymentDto.amount,
      createPaymentDto.provider,
      createPaymentDto.method,
      createPaymentDto.payerCpf,
      createPaymentDto.payerBirthDate,
    );
  }

  @Post('webhook/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Payment webhook handler' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid signature' })
  async webhook(
    @Param('provider') provider: string,
    @Body() webhookData: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    @RawBody() rawBody: Buffer,
    @Headers('x-signature') signature?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    // Only process Mercado Pago webhooks for now
    if (provider === 'mercadopago' || provider === 'mercado_pago') {
      // Mandatory signature verification — fail-closed
      const isValid = this.mpWebhookHandler.verifySignature(rawBody, signature || '');

      if (!isValid) {
        throw new UnauthorizedException('Invalid webhook signature.');
      }

      // Process webhook event
      await this.mpWebhookHandler.handleEvent(webhookData);

      return { status: 'ok', requestId };
    }

    return { status: 'ignored', provider };
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
  refundPayment(@Param('id') id: string, @Body('amount') amount?: number) {
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
