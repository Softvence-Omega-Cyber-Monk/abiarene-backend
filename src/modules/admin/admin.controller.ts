import { Body, Controller, Get, Param, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { AdminService } from './admin.service.js';
import {
  AdminSignupDto,
  AdminLoginDto,
  CreateTenantDto,
  AdminResponse,
  CreateTenantRoleDto,
  ListTenantRolesDto,
  CreateTenantUserDto,
  ListTenantUsersDto,
} from './admin.dto.js';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('signup')
  @Public()
  @ApiOperation({ summary: 'Admin signup' })
  @ApiResponse({ status: 201, description: 'Admin registered successfully' })
  @ApiResponse({ status: 400, description: 'Email already registered' })
  signup(@Body() dto: AdminSignupDto) {
    return this.adminService.signup(dto);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Admin login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
  }

  @Post('tenants')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new tenant' })
  @ApiResponse({ status: 201, description: 'Tenant created' })
  createTenant(@Body() dto: CreateTenantDto) {
    return this.adminService.createTenant(dto);
  }

  @Get('tenants')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all tenants' })
  @ApiResponse({ status: 200, description: 'Tenants list retrieved' })
  listTenants(@Query('page') page: string = '1', @Query('limit') limit: string = '10') {
    return this.adminService.listTenants(parseInt(page), parseInt(limit));
  }

  @Post('tenants/:tenantId/roles')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a role under a tenant' })
  @ApiResponse({ status: 201, description: 'Tenant role created' })
  createTenantRole(@Param('tenantId') tenantId: string, @Body() dto: CreateTenantRoleDto) {
    return this.adminService.createTenantRole(tenantId, dto);
  }

  @Get('tenants/:tenantId/roles')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List roles under a tenant' })
  @ApiResponse({ status: 200, description: 'Tenant roles retrieved' })
  listTenantRoles(@Param('tenantId') tenantId: string, @Query() dto: ListTenantRolesDto) {
    return this.adminService.listTenantRoles(tenantId, dto);
  }

  @Post('tenants/:tenantId/users')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a user under a tenant' })
  @ApiResponse({ status: 201, description: 'Tenant user created' })
  createTenantUser(@Param('tenantId') tenantId: string, @Body() dto: CreateTenantUserDto) {
    return this.adminService.createTenantUser(tenantId, dto);
  }

  @Get('tenants/:tenantId/users')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List users under a tenant' })
  @ApiResponse({ status: 200, description: 'Tenant users retrieved' })
  listTenantUsers(@Param('tenantId') tenantId: string, @Query() dto: ListTenantUsersDto) {
    return this.adminService.listTenantUsers(tenantId, dto);
  }

  @Get('dashboard')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get admin dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  dashboard(@CurrentUser() user: AuthUser | undefined) {
    if (!user?.tenantId) throw new UnauthorizedException('Missing tenant context');
    return this.adminService.dashboard(user.tenantId);
  }
}
