import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { CreateMenuDto, ListMenuDto, UpdateMenuDto } from './menu.dto.js';
import { MenuService } from './menu.service.js';

@ApiTags('Menu')
@ApiBearerAuth()
@Controller('menu')
export class MenuController {
  constructor(private readonly service: MenuService) {}

  private tenantId(user?: AuthUser) {
    if (!user?.tenantId) throw new UnauthorizedException('Missing tenant context');
    return user.tenantId;
  }

  @Post()
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Create menu' })
  @ApiResponse({ status: 201, description: 'Menu created' })
  create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateMenuDto) {
    return this.service.create(this.tenantId(user), dto);
  }

  @Get()
  @ApiOperation({ summary: 'List menus' })
  @ApiResponse({ status: 200, description: 'Menus retrieved' })
  list(@CurrentUser() user: AuthUser | undefined, @Query() dto: ListMenuDto) {
    return this.service.list(this.tenantId(user), dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get menu by ID' })
  @ApiResponse({ status: 200, description: 'Menu retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.tenantId(user), id);
  }

  @Patch(':id')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Update menu by ID' })
  @ApiResponse({ status: 200, description: 'Menu updated' })
  update(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string, @Body() dto: UpdateMenuDto) {
    return this.service.update(this.tenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete menu by ID' })
  @ApiResponse({ status: 200, description: 'Menu deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.tenantId(user), id);
  }
}
