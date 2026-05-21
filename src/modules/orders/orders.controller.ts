import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @Roles('manager', 'supervisor', 'server')
  @ApiOperation({ summary: 'Create a confirmed order with selected menu items for a table under your current tenant' })
  @ApiResponse({ status: 201, description: 'Confirmed order created with selected menu items and table marked occupied under your current tenant' })
  create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateOrdersDto) {
    const me = this.me(user);
    return this.service.create(me.tenantId, me.sub, dto);
  }

  @Get()
  @Roles('manager', 'supervisor', 'server')
  @ApiOperation({ summary: 'List orders under your current tenant' })
  @ApiResponse({ status: 200, description: 'Orders retrieved' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  list(
    @CurrentUser() user: AuthUser | undefined,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.service.list(this.me(user).tenantId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    } as ListOrdersDto);
  }

  @Get('history')
  @Roles('manager', 'supervisor', 'cashier')
  @ApiOperation({ summary: 'List paid completed order history under your current tenant' })
  @ApiResponse({ status: 200, description: 'Paid completed order history retrieved' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  history(
    @CurrentUser() user: AuthUser | undefined,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.service.listHistory(this.me(user).tenantId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    } as ListOrdersDto);
  }

  @Get(':id')
  @Roles('manager', 'supervisor', 'server')
  @ApiOperation({ summary: 'Get order by ID under your current tenant' })
  @ApiResponse({ status: 200, description: 'Order retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.me(user).tenantId, id);
  }

  @Patch(':id')
  @Roles('manager', 'supervisor', 'server')
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
  @Roles('manager', 'supervisor', 'server')
  @ApiOperation({ summary: 'Delete order by ID under your current tenant' })
  @ApiResponse({ status: 200, description: 'Order deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.me(user).tenantId, id);
  }

  @Post(':id/cancel')
  @Roles('manager', 'supervisor', 'server')
  @ApiOperation({ summary: 'Cancel an order under your current tenant' })
  @ApiResponse({ status: 201, description: 'Order cancelled and table released' })
  cancel(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.cancel(this.me(user).tenantId, id);
  }

  @Post(':id/send-to-kitchen')
  @Roles('manager', 'supervisor', 'server')
  @ApiOperation({ summary: 'Send an order to kitchen and create a kitchen ticket under your current tenant' })
  @ApiResponse({ status: 201, description: 'Order sent to kitchen, kitchen ticket created, and order status changed to PREPARING' })
  sendToKitchen(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.sendToKitchen(this.me(user).tenantId, id);
  }
}
