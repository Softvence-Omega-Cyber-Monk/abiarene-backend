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
import { RoleName } from '../../../common/constants/role-name.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../../common/interfaces/auth-user.interface.js';
import {
  InitiateSubscriptionPaymentDto,
  ListTenantRolesDto,
  UpdateTenantDto,
} from '../tenant.dto.js';
import { TenantPortalService } from '../services/tenant-portal.service.js';

@ApiTags('Tenant Portal')
@ApiBearerAuth()
@Controller('tenant')
export class TenantPortalController {
  constructor(private readonly service: TenantPortalService) {}

  private tenantId(user?: AuthUser) {
    if (!user?.tenantId) {
      throw new UnauthorizedException('Missing tenant context');
    }
    return user.tenantId;
  }

  @Get('me')
  @Roles('manager', 'supervisor', 'server', 'kitchen', 'cashier')
  @ApiOperation({ summary: 'Get current tenant' })
  @ApiResponse({ status: 200, description: 'Current tenant retrieved' })
  read(@CurrentUser() user: AuthUser | undefined) {
    return this.service.read(this.tenantId(user));
  }

  @Get('overview')
  @Roles('manager', 'supervisor')
  @ApiOperation({ summary: 'Get manager overview metrics for the current tenant' })
  @ApiResponse({ status: 200, description: 'Manager overview metrics retrieved' })
  overview(@CurrentUser() user: AuthUser | undefined) {
    return this.service.overview(this.tenantId(user));
  }

  @Get('daily-sales-history')
  @Roles('manager', 'supervisor')
  @ApiOperation({ summary: 'Get daily sales history for the current tenant' })
  @ApiResponse({ status: 200, description: 'Daily sales history retrieved' })
  @ApiQuery({
    name: 'days',
    required: false,
    type: String,
    example: '7',
    description: 'Number of days to include, between 1 and 90',
  })
  dailySalesHistory(
    @CurrentUser() user: AuthUser | undefined,
    @Query('days') days?: string,
  ) {
    return this.service.dailySalesHistory(
      this.tenantId(user),
      days ? parseInt(days, 10) : undefined,
    );
  }

  @Get('total-transactions')
  @Roles('manager', 'supervisor')
  @ApiOperation({ summary: 'Get total transaction summary for the current tenant' })
  @ApiResponse({ status: 200, description: 'Transaction summary retrieved' })
  totalTransactions(@CurrentUser() user: AuthUser | undefined) {
    return this.service.totalTransactions(this.tenantId(user));
  }

  @Get('active-discounts')
  @Roles('manager', 'supervisor')
  @ApiOperation({ summary: 'Get active discount or voucher summary for the current tenant' })
  @ApiResponse({ status: 200, description: 'Active discount summary retrieved' })
  activeDiscounts(@CurrentUser() user: AuthUser | undefined) {
    return this.service.activeDiscounts(this.tenantId(user));
  }

  @Patch('me')
  @Roles('manager', 'supervisor')
  @ApiOperation({ summary: 'Update current tenant' })
  @ApiResponse({ status: 200, description: 'Current tenant updated' })
  update(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.service.update(this.tenantId(user), dto);
  }

  @Get('subscription/me')
  @Roles('manager', 'supervisor')
  @ApiOperation({ summary: 'Get current tenant subscription status and payment options' })
  @ApiResponse({ status: 200, description: 'Current tenant subscription details retrieved' })
  getSubscription(@CurrentUser() user: AuthUser | undefined) {
    return this.service.getSubscription(this.tenantId(user));
  }

  @Get(':tenantId/roles')
  @Roles('manager', 'supervisor', 'admin')
  @ApiOperation({ summary: 'List roles under your own tenant scope' })
  @ApiResponse({ status: 200, description: 'Tenant roles retrieved' })
  @ApiResponse({ status: 403, description: 'You can only access roles for your own tenant' })
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
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    } as ListTenantRolesDto);
  }

  @Get('subscription/payments/:reference/status')
  @Roles('manager', 'supervisor')
  @ApiOperation({ summary: 'Get current tenant subscription payment status by reference' })
  @ApiResponse({ status: 200, description: 'Tenant subscription payment status retrieved' })
  getSubscriptionPaymentStatus(
    @CurrentUser() user: AuthUser | undefined,
    @Param('reference') reference: string,
  ) {
    return this.service.getSubscriptionPaymentStatus(
      this.tenantId(user),
      reference,
    );
  }

  @Post('subscription/pay')
  @Roles('manager', 'supervisor')
  @ApiOperation({ summary: 'Initiate tenant subscription payment for the current manager tenant' })
  @ApiResponse({ status: 201, description: 'Tenant subscription payment initiated' })
  initiateSubscriptionPayment(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: InitiateSubscriptionPaymentDto,
  ) {
    if (!user?.sub) {
      throw new UnauthorizedException('Missing user context');
    }

    return this.service.initiateSubscriptionPayment(
      this.tenantId(user),
      user.sub,
      dto,
    );
  }
}
