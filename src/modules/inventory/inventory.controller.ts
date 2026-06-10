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
  ListInventoryDeletionRequestsDto,
  ListInventoryDto,
  RejectInventoryDeletionRequestDto,
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

  private me(
    user?: AuthUser,
  ): AuthUser & { tenantId: string; sub: string; role: string } {
    if (!user?.tenantId || !user?.sub || !user?.role) {
      throw new UnauthorizedException('Missing user context');
    }

    return user as AuthUser & { tenantId: string; sub: string; role: string };
  }

  @Post()
  @Roles('manager', 'supervisor', 'admin')
  @ApiOperation({ summary: 'Create inventory item under your current tenant' })
  @ApiResponse({
    status: 201,
    description: 'Inventory item created under your current tenant',
  })
  create(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: CreateInventoryDto,
  ) {
    return this.service.create(this.tenantId(user), dto);
  }

  @Get()
  @ApiOperation({ summary: 'List inventory items under your current tenant' })
  @ApiResponse({
    status: 200,
    description: 'Inventory items retrieved for your current tenant',
  })
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
  @Roles('manager', 'supervisor')
  @ApiOperation({
    summary: 'List low-stock inventory alerts under your current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Low-stock inventory alerts retrieved for your current tenant',
  })
  stockAlerts(@CurrentUser() user: AuthUser | undefined) {
    return this.service.stockAlerts(this.tenantId(user));
  }

  @Get('by-inventory/:inventory')
  @ApiOperation({ summary: 'Get inventory item by inventory value' })
  @ApiParam({
    name: 'inventory',
    description:
      'Inventory lookup value. Matches product name, SKU, or barcode',
    example: 'PRD-1001',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory item retrieved by inventory value',
  })
  readByInventory(
    @CurrentUser() user: AuthUser | undefined,
    @Param('inventory') inventory: string,
  ) {
    return this.service.readByInventory(this.tenantId(user), inventory);
  }

  @Get('delete-requests')
  @Roles('manager', 'supervisor', 'admin')
  @ApiOperation({
    summary: 'List inventory deletion requests under your current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory deletion requests retrieved',
  })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    example: 'PENDING',
  })
  listDeletionRequests(
    @CurrentUser() user: AuthUser | undefined,
    @Query() dto: ListInventoryDeletionRequestsDto,
  ) {
    return this.service.listDeletionRequests(this.tenantId(user), dto);
  }

  @Post('delete-requests/:requestId/approve')
  @Roles('supervisor', 'admin')
  @ApiOperation({ summary: 'Approve a pending inventory deletion request' })
  @ApiResponse({
    status: 201,
    description: 'Inventory deletion request approved and item deleted',
  })
  approveDeletionRequest(
    @CurrentUser() user: AuthUser | undefined,
    @Param('requestId') requestId: string,
  ) {
    const me = this.me(user);
    return this.service.approveDeletionRequest(me.tenantId, requestId, me.sub);
  }

  @Post('delete-requests/:requestId/reject')
  @Roles('supervisor', 'admin')
  @ApiOperation({ summary: 'Reject a pending inventory deletion request' })
  @ApiResponse({
    status: 201,
    description: 'Inventory deletion request rejected',
  })
  rejectDeletionRequest(
    @CurrentUser() user: AuthUser | undefined,
    @Param('requestId') requestId: string,
    @Body() dto: RejectInventoryDeletionRequestDto,
  ) {
    const me = this.me(user);
    return this.service.rejectDeletionRequest(
      me.tenantId,
      requestId,
      me.sub,
      dto.reason,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  @ApiResponse({ status: 200, description: 'Inventory item retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.tenantId(user), id);
  }

  @Patch(':id')
  @Roles('manager', 'supervisor', 'admin')
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
  @Roles('manager', 'supervisor', 'admin')
  @ApiOperation({
    summary: 'Delete inventory item by ID or request supervisor approval',
  })
  @ApiResponse({
    status: 200,
    description: 'Inventory item deleted or deletion approval requested',
  })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    const me = this.me(user);
    return this.service.delete(me.tenantId, id, me);
  }
}
