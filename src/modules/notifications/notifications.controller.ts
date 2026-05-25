import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '@/common/interfaces/request.interface';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated notifications' })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.notificationsService.findAll(req.user.id, page, limit);
  }

  @Get('unread/count')
  @ApiOperation({ summary: 'Count unread notifications' })
  @ApiResponse({ status: 200, description: 'Unread count' })
  countUnread(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.countUnread(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification by ID' })
  @ApiResponse({ status: 200, description: 'Notification found' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.notificationsService.findOne(id, req.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Marked as read' })
  markAsRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.notificationsService.markAsRead(id, req.user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All marked as read' })
  markAllAsRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllAsRead(req.user.id);
  }
}
