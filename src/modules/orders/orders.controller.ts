import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { CreateOrdersDto, ListOrdersDto, UpdateOrdersDto } from './orders.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}
  private me(user?: AuthUser) {
    if (!user?.tenantId || !user?.sub) {
      throw new UnauthorizedException('Missing user context');
    }
    return user;
  }

  @Post()
  @Roles('manager', 'server')
  @ApiOperation({ summary: 'Create an order with selected menu items for a table under your current tenant' })
  @ApiResponse({ status: 201, description: 'Order created with selected menu items and table marked occupied under your current tenant' })
  create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateOrdersDto) {
    const me = this.me(user);
    return this.service.create(me.tenantId, me.sub, dto);
  }

  @Get()
  @Roles('manager', 'server')
  @ApiOperation({ summary: 'List orders under your current tenant' })
  @ApiResponse({ status: 200, description: 'Orders retrieved' })
  list(@CurrentUser() user: AuthUser | undefined, @Query() dto: ListOrdersDto) {
    return this.service.list(this.me(user).tenantId, dto);
  }

  @Get(':id')
  @Roles('manager', 'server')
  @ApiOperation({ summary: 'Get order by ID under your current tenant' })
  @ApiResponse({ status: 200, description: 'Order retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.me(user).tenantId, id);
  }

  @Patch(':id')
  @Roles('manager', 'server')
  @ApiOperation({ summary: 'Update order by ID under your current tenant' })
  @ApiResponse({ status: 200, description: 'Order updated' })
  update(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateOrdersDto,
  ) {
    return this.service.update(this.me(user).tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('manager', 'server')
  @ApiOperation({ summary: 'Delete order by ID under your current tenant' })
  @ApiResponse({ status: 200, description: 'Order deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.me(user).tenantId, id);
  }

  @Post(':id/send-to-kitchen')
  @Roles('manager', 'server')
  @ApiOperation({ summary: 'Send an order to kitchen and create a kitchen ticket under your current tenant' })
  @ApiResponse({ status: 201, description: 'Order sent to kitchen and kitchen ticket created' })
  sendToKitchen(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.sendToKitchen(this.me(user).tenantId, id);
  }
}
