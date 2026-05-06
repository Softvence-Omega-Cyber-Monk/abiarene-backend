import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { CreateMenuDto, ListMenuDto, UpdateMenuDto } from './menu.dto.js';
import { MenuService } from './menu.service.js';

@ApiTags('Items')
@ApiBearerAuth()
@Controller('items')
export class MenuController {
  constructor(private readonly service: MenuService) {}

  private tenantId(user?: AuthUser) {
    if (!user?.tenantId) throw new UnauthorizedException('Missing tenant context');
    return user.tenantId;
  }

  private listDto(page: string, limit: string, search?: string): ListMenuDto {
    return {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
    };
  }

  @Post()
  @Roles('manager')
  @ApiOperation({ summary: 'Create item under your current tenant' })
  @ApiResponse({ status: 201, description: 'Item created under your current tenant' })
  create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateMenuDto) {
    return this.service.create(this.tenantId(user), dto);
  }

  @Get()
  @ApiOperation({ summary: 'List items under your current tenant' })
  @ApiResponse({ status: 200, description: 'Items retrieved for your current tenant' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'Burger' })
  list(
    @CurrentUser() user: AuthUser | undefined,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    return this.service.list(this.tenantId(user), this.listDto(page, limit, search));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get item by item ID under your current tenant' })
  @ApiResponse({ status: 200, description: 'Item retrieved for your current tenant' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.tenantId(user), id);
  }

  @Patch(':id')
  @Roles('manager')
  @ApiOperation({ summary: 'Update item by item ID under your current tenant' })
  @ApiResponse({ status: 200, description: 'Item updated under your current tenant' })
  update(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string, @Body() dto: UpdateMenuDto) {
    return this.service.update(this.tenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  @ApiOperation({ summary: 'Delete item by item ID under your current tenant' })
  @ApiResponse({ status: 200, description: 'Item deleted under your current tenant' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.tenantId(user), id);
  }

  @Post('tenant/:tenantId')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin create item under a specified tenant' })
  @ApiResponse({ status: 201, description: 'Item created under the specified tenant' })
  createForTenant(@Param('tenantId') tenantId: string, @Body() dto: CreateMenuDto) {
    return this.service.create(tenantId, dto);
  }

  @Get('tenant/:tenantId')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin list items under a specified tenant' })
  @ApiResponse({ status: 200, description: 'Items retrieved for the specified tenant' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'Burger' })
  listForTenant(
    @Param('tenantId') tenantId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    return this.service.list(tenantId, this.listDto(page, limit, search));
  }

  @Get('tenant/:tenantId/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin get item by item ID under a specified tenant' })
  @ApiResponse({ status: 200, description: 'Item retrieved for the specified tenant' })
  readForTenant(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.service.read(tenantId, id);
  }

  @Patch('tenant/:tenantId/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin update item by item ID under a specified tenant' })
  @ApiResponse({ status: 200, description: 'Item updated under the specified tenant' })
  updateForTenant(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMenuDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete('tenant/:tenantId/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin delete item by item ID under a specified tenant' })
  @ApiResponse({ status: 200, description: 'Item deleted under the specified tenant' })
  deleteForTenant(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.service.delete(tenantId, id);
  }
}
