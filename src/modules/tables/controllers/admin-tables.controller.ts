import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import {
  CreateTablesDto,
  ListTablesDto,
  SetTableItemsDto,
  UpdateTablesDto,
} from '../tables.dto.js';
import { AdminTablesService } from '../services/admin-tables.service.js';

@ApiTags('Admin Tables')
@ApiBearerAuth()
@Controller('tables/tenant')
export class AdminTablesController {
  constructor(private readonly service: AdminTablesService) {}

  private listDto(page: string, limit: string): ListTablesDto {
    return {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    };
  }

  @Post(':tenantId')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin create table under any tenant' })
  @ApiResponse({ status: 201, description: 'Table created' })
  createForTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateTablesDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  @Get(':tenantId')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin list tables under any tenant' })
  @ApiResponse({ status: 200, description: 'Tables retrieved' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  listForTenant(
    @Param('tenantId') tenantId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.service.list(tenantId, this.listDto(page, limit));
  }

  @Get(':tenantId/menu')
  @Roles('admin')
  @ApiOperation({
    summary: 'Admin get the shared menu under a specified tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Shared menu retrieved for the specified tenant',
  })
  getMenuForTenant(@Param('tenantId') tenantId: string) {
    return this.service.getMenu(tenantId);
  }

  @Patch(':tenantId/menu')
  @Roles('admin')
  @ApiOperation({
    summary:
      'Admin add new items to the shared menu for all tables under a specified tenant',
  })
  @ApiResponse({
    status: 200,
    description:
      'New shared menu items added for all tables under the specified tenant',
  })
  setMenuForTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: SetTableItemsDto,
  ) {
    return this.service.setMenu(tenantId, dto);
  }

  @Delete(':tenantId/menu/items/:itemId')
  @Roles('admin')
  @ApiOperation({
    summary:
      'Admin remove one item from the shared menu under a specified tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Shared menu item removed for the specified tenant',
  })
  removeMenuItemForTenant(
    @Param('tenantId') tenantId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeMenuItem(tenantId, itemId);
  }

  @Get(':tenantId/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin get table by ID under any tenant' })
  @ApiResponse({ status: 200, description: 'Table retrieved' })
  readForTenant(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.service.read(tenantId, id);
  }

  @Get(':tenantId/:id/items')
  @Roles('admin')
  @ApiOperation({
    summary:
      'Admin list shared menu items for a table under a specified tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Shared menu items retrieved for the specified tenant',
  })
  listItemsForTenant(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.listItems(tenantId, id);
  }

  @Patch(':tenantId/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin update table by ID under any tenant' })
  @ApiResponse({ status: 200, description: 'Table updated' })
  updateForTenant(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTablesDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':tenantId/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin delete table by ID under any tenant' })
  @ApiResponse({ status: 200, description: 'Table deleted' })
  deleteForTenant(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.delete(tenantId, id);
  }
}
