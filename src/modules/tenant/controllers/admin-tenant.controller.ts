import {
  Body,
  Controller,
  ForbiddenException,
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
import { RoleName } from '../../../common/constants/role-name.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { AuthUser } from '../../../common/interfaces/auth-user.interface.js';
import {
  CreateTenantDto,
  ListTenantDto,
  ListTenantRolesDto,
  UpdateTenantRolesDto,
  UpdateTenantStatusDto,
} from '../tenant.dto.js';
import { AdminTenantService } from '../services/admin-tenant.service.js';

@ApiTags('Admin Tenant')
@ApiBearerAuth()
@Controller('tenant')
export class AdminTenantController {
  constructor(private readonly service: AdminTenantService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created' })
  create(@Body() dto: CreateTenantDto) {
    return this.service.create(dto);
  }

  @Get('all')
  @ApiOperation({ summary: 'List all tenants for admin' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved' })
  @ApiResponse({ status: 403, description: 'This route is for admin only' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  listAll(
    @CurrentUser() user: AuthUser | undefined,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    if (user?.role?.toUpperCase() !== RoleName.ADMIN) {
      throw new ForbiddenException('This route is for admin only');
    }

    return this.service.listAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    } as ListTenantDto);
  }

  @Patch(':tenantId/roles')
  @ApiOperation({ summary: 'Enable roles under a tenant for admin' })
  @ApiResponse({ status: 200, description: 'Tenant roles updated' })
  @ApiResponse({ status: 403, description: 'This route is for admin only' })
  updateRoles(
    @CurrentUser() user: AuthUser | undefined,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantRolesDto,
  ) {
    if (user?.role?.toUpperCase() !== RoleName.ADMIN) {
      throw new ForbiddenException('This route is for admin only');
    }

    return this.service.updateRoles(tenantId, dto);
  }

  @Patch(':tenantId/status')
  @ApiOperation({ summary: 'Update tenant active or inactive status for admin' })
  @ApiResponse({ status: 200, description: 'Tenant status updated' })
  @ApiResponse({ status: 403, description: 'This route is for admin only' })
  updateStatus(
    @CurrentUser() user: AuthUser | undefined,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    if (user?.role?.toUpperCase() !== RoleName.ADMIN) {
      throw new ForbiddenException('This route is for admin only');
    }

    return this.service.updateStatus(tenantId, dto);
  }

  @Get(':tenantId/roles')
  @ApiOperation({ summary: 'List roles under a tenant for admin' })
  @ApiResponse({ status: 200, description: 'Tenant roles retrieved' })
  @ApiResponse({ status: 403, description: 'This route is for admin only' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  listRoles(
    @CurrentUser() user: AuthUser | undefined,
    @Param('tenantId') tenantId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    if (user?.role?.toUpperCase() !== RoleName.ADMIN) {
      throw new ForbiddenException('This route is for admin only');
    }

    return this.service.listRoles(tenantId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    } as ListTenantRolesDto);
  }
}
