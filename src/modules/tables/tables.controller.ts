import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import {
  CashierCheckoutDto,
  CreateTablesDto,
  ListTablesDto,
  SetTableItemsDto,
  UpdateTablesDto,
} from './tables.dto.js';
import { TablesService } from './tables.service.js';

@ApiTags('Tables')
@ApiBearerAuth()
@Controller('tables')
export class TablesController {
  constructor(private readonly service: TablesService) {}

  private tenantId(user?: AuthUser) {
    if (!user?.tenantId)
      throw new UnauthorizedException('Missing tenant context');
    return user.tenantId;
  }

  private listDto(page: string, limit: string): ListTablesDto {
    return {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    };
  }

  @Post()
  @Roles('manager')
  @ApiOperation({ summary: 'Create table' })
  @ApiResponse({ status: 201, description: 'Table created' })
  @ApiBody({
    type: CreateTablesDto,
    examples: {
      available: {
        summary: 'Available table',
        value: {
          tableNumber: 12,
          seatCount: 4,
          status: 'AVAILABLE',
        },
      },
      occupied: {
        summary: 'Occupied table',
        value: {
          tableNumber: 13,
          seatCount: 4,
          status: 'OCCUPIED',
        },
      },
      served: {
        summary: 'Served table flag',
        value: {
          tableNumber: 14,
          seatCount: 6,
          status: 'OCCUPIED',
          served: true,
        },
      },
    },
  })
  create(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: CreateTablesDto,
  ) {
    return this.service.create(this.tenantId(user), dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tables' })
  @ApiResponse({ status: 200, description: 'Tables retrieved' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  list(
    @CurrentUser() user: AuthUser | undefined,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.service.list(this.tenantId(user), this.listDto(page, limit));
  }

  @Post('tenant/:tenantId')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin create table under any tenant' })
  @ApiResponse({ status: 201, description: 'Table created' })
  createForTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateTablesDto,
  ) {
    return this.service.create(tenantId, dto);
  }

  @Get('tenant/:tenantId')
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

  @Get('tenant/:tenantId/menu')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin get the shared menu under a specified tenant' })
  @ApiResponse({ status: 200, description: 'Shared menu retrieved for the specified tenant' })
  getMenuForTenant(@Param('tenantId') tenantId: string) {
    return this.service.getMenu(tenantId);
  }

  @Patch('tenant/:tenantId/menu')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin add new items to the shared menu for all tables under a specified tenant' })
  @ApiResponse({ status: 200, description: 'New shared menu items added for all tables under the specified tenant' })
  setMenuForTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: SetTableItemsDto,
  ) {
    return this.service.setMenu(tenantId, dto);
  }

  @Delete('tenant/:tenantId/menu/items/:itemId')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin remove one item from the shared menu under a specified tenant' })
  @ApiResponse({ status: 200, description: 'Shared menu item removed for the specified tenant' })
  removeMenuItemForTenant(
    @Param('tenantId') tenantId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeMenuItem(tenantId, itemId);
  }

  @Get('tenant/:tenantId/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin get table by ID under any tenant' })
  @ApiResponse({ status: 200, description: 'Table retrieved' })
  readForTenant(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.service.read(tenantId, id);
  }

  @Get('tenant/:tenantId/:id/items')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin list shared menu items for a table under a specified tenant' })
  @ApiResponse({ status: 200, description: 'Shared menu items retrieved for the specified tenant' })
  listItemsForTenant(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
  ) {
    return this.service.listItems(tenantId, id);
  }

  @Patch('tenant/:tenantId/:id')
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

  @Delete('tenant/:tenantId/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin delete table by ID under any tenant' })
  @ApiResponse({ status: 200, description: 'Table deleted' })
  deleteForTenant(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.service.delete(tenantId, id);
  }

  @Get('menu')
  @ApiOperation({ summary: 'Get the shared menu under your current tenant' })
  @ApiResponse({ status: 200, description: 'Shared menu retrieved for your current tenant' })
  getMenu(@CurrentUser() user: AuthUser | undefined) {
    return this.service.getMenu(this.tenantId(user));
  }

  @Patch('menu')
  @Roles('manager')
  @ApiOperation({ summary: 'Add new items to the shared menu for all tables under your current tenant' })
  @ApiResponse({ status: 200, description: 'New shared menu items added for all tables under your current tenant' })
  setMenu(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: SetTableItemsDto,
  ) {
    return this.service.setMenu(this.tenantId(user), dto);
  }

  @Delete('menu/items/:itemId')
  @Roles('manager')
  @ApiOperation({ summary: 'Remove one item from the shared menu under your current tenant' })
  @ApiResponse({ status: 200, description: 'Shared menu item removed for your current tenant' })
  removeMenuItem(
    @CurrentUser() user: AuthUser | undefined,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeMenuItem(this.tenantId(user), itemId);
  }

  @Get(':id/cashier-summary')
  @Roles('cashier', 'manager')
  @ApiOperation({ summary: 'Get cashier checkout summary for a table under your current tenant' })
  @ApiResponse({ status: 200, description: 'Cashier checkout summary retrieved for the selected table' })
  getCashierSummary(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
  ) {
    return this.service.getCashierSummary(this.tenantId(user), id);
  }

  @Post(':id/cashier-checkout')
  @Roles('cashier', 'manager')
  @ApiOperation({ summary: 'Complete cashier checkout for a table under your current tenant' })
  @ApiResponse({ status: 200, description: 'Cashier checkout completed and the table was marked as served' })
  cashierCheckout(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: CashierCheckoutDto,
  ) {
    return this.service.completeCashierCheckout(this.tenantId(user), id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get table by ID' })
  @ApiResponse({ status: 200, description: 'Table retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.tenantId(user), id);
  }

  @Get(':id/items')
  @ApiOperation({ summary: 'List shared menu items for a table under your current tenant' })
  @ApiResponse({ status: 200, description: 'Shared menu items retrieved for your current tenant' })
  listItems(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
  ) {
    return this.service.listItems(this.tenantId(user), id);
  }

  @Patch(':id')
  @Roles('server', 'manager')
  @ApiOperation({ summary: 'Update table by ID' })
  @ApiResponse({ status: 200, description: 'Table updated' })
  @ApiBody({
    type: UpdateTablesDto,
    examples: {
      available: {
        summary: 'Mark available',
        value: {
          status: 'AVAILABLE',
        },
      },
      occupied: {
        summary: 'Mark occupied',
        value: {
          status: 'OCCUPIED',
        },
      },
      served: {
        summary: 'Mark served',
        value: {
          served: true,
        },
      },
      unserved: {
        summary: 'Mark not served',
        value: {
          served: false,
        },
      },
    },
  })
  update(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateTablesDto,
  ) {
    return this.service.update(this.tenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  @ApiOperation({ summary: 'Delete table by ID' })
  @ApiResponse({ status: 200, description: 'Table deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.tenantId(user), id);
  }
}
