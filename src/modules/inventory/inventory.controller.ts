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
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import {
  CreateInventoryDto,
  ListInventoryDto,
  UpdateInventoryDto,
} from './inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  private tenantId(user?: AuthUser) {
    if (!user?.tenantId)
      throw new UnauthorizedException('Missing tenant context');
    return user.tenantId;
  }

  @Post()
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Create inventory item under your current tenant' })
  @ApiResponse({ status: 201, description: 'Inventory item created under your current tenant' })
  create(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: CreateInventoryDto,
  ) {
    return this.service.create(this.tenantId(user), dto);
  }

  @Get()
  @ApiOperation({ summary: 'List inventory items under your current tenant' })
  @ApiResponse({ status: 200, description: 'Inventory items retrieved for your current tenant' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  list(
    @CurrentUser() user: AuthUser | undefined,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.service.list(this.tenantId(user), {
      page: parseInt(page),
      limit: parseInt(limit),
    } as ListInventoryDto);
  }

  @Get('stock-alerts')
  @Roles('manager')
  @ApiOperation({ summary: 'List low-stock inventory alerts under your current tenant' })
  @ApiResponse({ status: 200, description: 'Low-stock inventory alerts retrieved for your current tenant' })
  stockAlerts(@CurrentUser() user: AuthUser | undefined) {
    return this.service.stockAlerts(this.tenantId(user));
  }

  @Get('by-inventory/:inventory')
  @ApiOperation({ summary: 'Get inventory item by inventory value' })
  @ApiParam({
    name: 'inventory',
    description: 'Inventory lookup value. Matches product name, SKU, or barcode',
    example: 'PRD-1001',
  })
  @ApiResponse({ status: 200, description: 'Inventory item retrieved by inventory value' })
  readByInventory(
    @CurrentUser() user: AuthUser | undefined,
    @Param('inventory') inventory: string,
  ) {
    return this.service.readByInventory(this.tenantId(user), inventory);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  @ApiResponse({ status: 200, description: 'Inventory item retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.tenantId(user), id);
  }

  @Patch(':id')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Update inventory item by ID' })
  @ApiResponse({ status: 200, description: 'Inventory item updated' })
  update(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.service.update(this.tenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Delete inventory item by ID' })
  @ApiResponse({ status: 200, description: 'Inventory item deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.tenantId(user), id);
  }
}
