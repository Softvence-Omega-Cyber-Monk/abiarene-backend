import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { ListNotificationsDto } from './notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user scope' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiQuery({
    name: 'isRead',
    required: false,
    type: String,
    example: 'false',
  })
  list(
    @CurrentUser() user: AuthUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('isRead') isRead?: string,
  ) {
    return this.service.list(user, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      ...(isRead === undefined ? {} : { isRead: isRead === 'true' }),
    } as ListNotificationsDto);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for the current user scope' })
  @ApiResponse({ status: 200, description: 'Unread notification count retrieved' })
  unreadCount(@CurrentUser() user: AuthUser) {
    return this.service.getUnreadCount(user);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.markRead(user, id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for the current user scope' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.service.markAllRead(user);
  }
}
