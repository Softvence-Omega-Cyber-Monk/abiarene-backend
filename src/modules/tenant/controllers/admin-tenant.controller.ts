import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
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

  @Get('all')
  @ApiOperation({ summary: 'List all tenants for admin' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved' })
  @ApiResponse({ status: 403, description: 'This route is for admin only' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    example: 'EUR',
    description:
      'Optional display currency for converted subscription fee preview in each tenant item',
  })
  listAll(
    @CurrentUser() user: AuthUser | undefined,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('currency') currency?: string,
  ) {
    if (user?.role?.toUpperCase() !== RoleName.ADMIN) {
      throw new ForbiddenException('This route is for admin only');
    }

    return this.service.listAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    } as ListTenantDto, currency);
  }

  @Patch(':tenantId/roles')
  @ApiOperation({ summary: 'Enable roles under a tenant for admin or supervisor' })
  @ApiResponse({ status: 200, description: 'Tenant roles updated' })
  @ApiResponse({ status: 403, description: 'This route is for admin or supervisor only' })
  updateRoles(
    @CurrentUser() user: AuthUser | undefined,
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantRolesDto,
  ) {
    const role = user?.role?.toUpperCase();
    if (role !== RoleName.ADMIN && role !== RoleName.SUPERVISOR) {
      throw new ForbiddenException('This route is for admin or supervisor only');
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
