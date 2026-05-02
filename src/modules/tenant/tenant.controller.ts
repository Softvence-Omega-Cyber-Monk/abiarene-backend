import {
  Body,
  Controller,
  ForbiddenException,
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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import {
  CreateTenantDto,
  ListTenantDto,
  ListTenantRolesDto,
  UpdateTenantRolesDto,
  UpdateTenantDto,
} from './tenant.dto.js';
import { TenantService } from './tenant.service.js';

@ApiTags('Tenant')
@ApiBearerAuth()
@Controller('tenant')
export class TenantController {
  constructor(private readonly service: TenantService) {}

  private tenantId(user?: AuthUser) {
    if (!user?.tenantId)
      throw new UnauthorizedException('Missing tenant context');
    return user.tenantId;
  }

  @Post('create')
  @Roles('admin')
  @ApiOperation({ summary: 'Create tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created' })
  create(@Body() dto: CreateTenantDto) {
    return this.service.create(dto);
  }

  @Get('all')
  @Roles('admin')
  @ApiOperation({ summary: 'List all tenants' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  listAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.service.listAll({
      page: parseInt(page),
      limit: parseInt(limit),
    } as ListTenantDto);
  }

  @Get('me')
  @Roles('manager')
  @ApiOperation({ summary: 'Get current tenant' })
  @ApiResponse({ status: 200, description: 'Current tenant retrieved' })
  read(@CurrentUser() user: AuthUser | undefined) {
    const tenantId = this.tenantId(user);
    return this.service.read(tenantId, tenantId);
  }

  @Patch('me')
  @Roles('manager')
  @ApiOperation({ summary: 'Update current tenant' })
  @ApiResponse({ status: 200, description: 'Current tenant updated' })
  update(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: UpdateTenantDto,
  ) {
    const tenantId = this.tenantId(user);
    return this.service.update(tenantId, tenantId, dto);
  }

  @Get(':tenantId/roles')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'List roles under a tenant' })
  @ApiResponse({ status: 200, description: 'Tenant roles retrieved' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  listRoles(
    @CurrentUser() user: AuthUser | undefined,
    @Param('tenantId') tenantId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    if (user?.role !== 'admin' && this.tenantId(user) !== tenantId) {
      throw new ForbiddenException('You can only access roles for your own tenant');
    }

    return this.service.listRoles(tenantId, {
      page: parseInt(page),
      limit: parseInt(limit),
    } as ListTenantRolesDto);
  }

  @Patch(':tenantId/roles')
  @Roles('admin')
  @ApiOperation({ summary: 'Enable roles under a tenant' })
  @ApiResponse({ status: 200, description: 'Tenant roles updated' })
  updateRoles(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpdateTenantRolesDto,
  ) {
    return this.service.updateRoles(tenantId, dto);
  }
}
