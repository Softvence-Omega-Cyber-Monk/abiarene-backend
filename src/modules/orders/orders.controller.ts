import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { AddOrderItemsDto, CreateOrdersDto, ListOrdersDto, UpdateOrdersDto } from './orders.dto.js';
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
  @ApiOperation({ summary: 'Create order' })
  @ApiResponse({ status: 201, description: 'Order created' })
  create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateOrdersDto) {
    const me = this.me(user);
    return this.service.create(me.tenantId, me.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List orders' })
  @ApiResponse({ status: 200, description: 'Orders retrieved' })
  list(@CurrentUser() user: AuthUser | undefined, @Query() dto: ListOrdersDto) {
    return this.service.list(this.me(user).tenantId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.me(user).tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update order by ID' })
  @ApiResponse({ status: 200, description: 'Order updated' })
  update(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateOrdersDto,
  ) {
    return this.service.update(this.me(user).tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete order by ID' })
  @ApiResponse({ status: 200, description: 'Order deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.me(user).tenantId, id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add items to an order' })
  @ApiResponse({ status: 201, description: 'Order items added' })
  addItems(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: AddOrderItemsDto,
  ) {
    return this.service.addItems(this.me(user).tenantId, id, dto);
  }

  @Post(':id/send-to-kitchen')
  @ApiOperation({ summary: 'Send order to kitchen' })
  @ApiResponse({ status: 201, description: 'Order sent to kitchen' })
  sendToKitchen(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.sendToKitchen(this.me(user).tenantId, id);
  }
}
