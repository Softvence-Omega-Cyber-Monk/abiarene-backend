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
import { RoleName } from '../../common/constants/role-name.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import {
  CreateTenantDto,
  InitiateSubscriptionPaymentDto,
  ListTenantDto,
  ListTenantRolesDto,
  UpdateTenantRolesDto,
  UpdateTenantStatusDto,
  UpdateTenantDto,
} from './tenant.dto.js';
import { TenantSubscriptionService } from './tenant-subscription.service.js';
import { TenantService } from './tenant.service.js';

@ApiTags('Tenant')
@ApiBearerAuth()
@Controller('tenant')
export class TenantController {
  constructor(
    private readonly service: TenantService,
    private readonly subscriptionService: TenantSubscriptionService,
  ) {}

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
      page: parseInt(page),
      limit: parseInt(limit),
    } as ListTenantDto);
  }

  @Get('me')
  @Roles('manager', 'server', 'kitchen', 'cashier')
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

  @Get('subscription/me')
  @Roles('manager')
  @ApiOperation({ summary: 'Get current tenant subscription status and payment options' })
  @ApiResponse({ status: 200, description: 'Current tenant subscription details retrieved' })
  getSubscription(@CurrentUser() user: AuthUser | undefined) {
    return this.subscriptionService.getSubscriptionDetails(this.tenantId(user));
  }

  @Post('subscription/pay')
  @Roles('manager')
  @ApiOperation({ summary: 'Initiate tenant subscription payment for the current manager tenant' })
  @ApiResponse({ status: 201, description: 'Tenant subscription payment initiated' })
  initiateSubscriptionPayment(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: InitiateSubscriptionPaymentDto,
  ) {
    if (!user?.sub) {
      throw new UnauthorizedException('Missing user context');
    }

    return this.subscriptionService.initiateSubscriptionPayment(
      this.tenantId(user),
      user.sub,
      dto,
    );
  }

  @Get('subscription/payments/:reference/status')
  @Roles('manager')
  @ApiOperation({ summary: 'Get current tenant subscription payment status by reference' })
  @ApiResponse({ status: 200, description: 'Tenant subscription payment status retrieved' })
  getSubscriptionPaymentStatus(
    @CurrentUser() user: AuthUser | undefined,
    @Param('reference') reference: string,
  ) {
    return this.subscriptionService.getSubscriptionPaymentStatus(
      this.tenantId(user),
      reference,
    );
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
    if (user?.role?.toUpperCase() !== RoleName.ADMIN && this.tenantId(user) !== tenantId) {
      throw new ForbiddenException('You can only access roles for your own tenant');
    }

    return this.service.listRoles(tenantId, {
      page: parseInt(page),
      limit: parseInt(limit),
    } as ListTenantRolesDto);
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

    return this.service.updateStatus(tenantId, dto.status);
  }
}
