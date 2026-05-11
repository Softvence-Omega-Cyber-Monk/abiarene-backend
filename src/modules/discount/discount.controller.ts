import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { CreateDiscountDto, ListDiscountDto, UpdateDiscountDto } from './discount.dto.js';
import { DiscountService } from './discount.service.js';

@ApiTags('Discount')
@ApiBearerAuth()
@Controller('discount')
export class DiscountController {
  constructor(private readonly service: DiscountService) {}

  private tenantId(user?: AuthUser) {
    if (!user?.tenantId) throw new UnauthorizedException('Missing tenant context');
    return user.tenantId;
  }

  @Post()
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Create discount under your current tenant' })
  @ApiResponse({ status: 201, description: 'Discount created' })
  create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateDiscountDto) {
    return this.service.create(this.tenantId(user), dto);
  }

  @Get()
  @Roles('manager', 'server', 'kitchen', 'cashier', 'admin')
  @ApiOperation({ summary: 'List discounts under your current tenant' })
  @ApiResponse({ status: 200, description: 'Discounts retrieved' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, example: true })
  list(
    @CurrentUser() user: AuthUser | undefined,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('isActive') isActive?: string,
  ) {
    return this.service.list(this.tenantId(user), {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      isActive: isActive === undefined ? undefined : isActive === 'true',
    } as ListDiscountDto);
  }

  @Get(':id')
  @Roles('manager', 'server', 'kitchen', 'cashier', 'admin')
  @ApiOperation({ summary: 'Get discount by ID' })
  @ApiResponse({ status: 200, description: 'Discount retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.tenantId(user), id);
  }

  @Patch(':id')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Update discount by ID' })
  @ApiResponse({ status: 200, description: 'Discount updated' })
  update(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string, @Body() dto: UpdateDiscountDto) {
    return this.service.update(this.tenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Delete discount by ID' })
  @ApiResponse({ status: 200, description: 'Discount deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.tenantId(user), id);
  }
}
