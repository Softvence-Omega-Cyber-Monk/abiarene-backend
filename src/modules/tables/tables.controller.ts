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
        summary: 'Served table',
        value: {
          tableNumber: 14,
          seatCount: 6,
          status: 'SERVED',
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

  @Get('tenant/:tenantId/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin get table by ID under any tenant' })
  @ApiResponse({ status: 200, description: 'Table retrieved' })
  readForTenant(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.service.read(tenantId, id);
  }

  @Get('tenant/:tenantId/:id/items')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin list items assigned to a table under any tenant' })
  @ApiResponse({ status: 200, description: 'Table items retrieved' })
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

  @Patch('tenant/:tenantId/:id/items')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin assign items to a table under any tenant' })
  @ApiResponse({ status: 200, description: 'Table items updated' })
  setItemsForTenant(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: SetTableItemsDto,
  ) {
    return this.service.setItems(tenantId, id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get table by ID' })
  @ApiResponse({ status: 200, description: 'Table retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.tenantId(user), id);
  }

  @Get(':id/items')
  @ApiOperation({ summary: 'List items assigned to a table' })
  @ApiResponse({ status: 200, description: 'Table items retrieved' })
  listItems(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
  ) {
    return this.service.listItems(this.tenantId(user), id);
  }

  @Patch(':id')
  @Roles('manager')
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
          status: 'SERVED',
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

  @Patch(':id/items')
  @Roles('manager')
  @ApiOperation({ summary: 'Assign items to a table' })
  @ApiResponse({ status: 200, description: 'Table items updated' })
  setItems(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: SetTableItemsDto,
  ) {
    return this.service.setItems(this.tenantId(user), id, dto);
  }
}
