import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { CreateNotificationsDto, ListNotificationsDto, UpdateNotificationsDto } from './notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  private tenantId(user?: AuthUser) {
    if (!user?.tenantId) throw new UnauthorizedException('Missing tenant context');
    return user.tenantId;
  }

  @Post()
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Create notification payload' })
  @ApiResponse({ status: 201, description: 'Notification payload created' })
  create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateNotificationsDto) {
    return this.service.create(this.tenantId(user), dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notification payloads' })
  @ApiResponse({ status: 200, description: 'Notification payloads retrieved' })
  list(@CurrentUser() user: AuthUser | undefined, @Query() dto: ListNotificationsDto) {
    return this.service.list(this.tenantId(user), dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get notification payload by ID' })
  @ApiResponse({ status: 200, description: 'Notification payload retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.tenantId(user), id);
  }

  @Patch(':id')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Update notification payload by ID' })
  @ApiResponse({ status: 200, description: 'Notification payload updated' })
  update(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string, @Body() dto: UpdateNotificationsDto) {
    return this.service.update(this.tenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete notification payload by ID' })
  @ApiResponse({ status: 200, description: 'Notification payload deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.tenantId(user), id);
  }
}
