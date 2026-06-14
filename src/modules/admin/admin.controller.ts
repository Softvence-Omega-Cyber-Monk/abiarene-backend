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
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { AdminService } from './admin.service.js';
import {
  AdminSignupDto,
  CreateSubscriptionPriceDto,
  CreateSubscriptionVoucherDto,
  UpdateSubscriptionPriceDto,
  UpdateSubscriptionVoucherDto,
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

  @Get('dashboard')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get admin dashboard' })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    example: 'EUR',
    description: 'Optional display currency for dashboard revenue values',
  })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  dashboard(
    @CurrentUser() user: AuthUser | undefined,
    @Query('currency') currency?: string,
  ) {
    if (!user?.sub) throw new UnauthorizedException('Missing admin context');
    return this.adminService.dashboard(currency);
  }

  @Get('me')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get admin own profile' })
  @ApiResponse({ status: 200, description: 'Admin profile retrieved' })
  getMyProfile(@CurrentUser() user: AuthUser | undefined) {
    if (!user?.sub) throw new UnauthorizedException('Missing admin context');
    return this.adminService.getMyProfile(user.sub);
  }

  @Post('subscription-prices')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a subscription price' })
  @ApiResponse({ status: 201, description: 'Subscription price created' })
  createSubscriptionPrice(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: CreateSubscriptionPriceDto,
  ) {
    if (!user?.sub) throw new UnauthorizedException('Missing admin context');
    return this.adminService.createSubscriptionPrice(user.sub, dto);
  }

  @Get('subscription-prices')
  @Public()
  @ApiOperation({ summary: 'Get all subscription prices' })
  @ApiQuery({
    name: 'currency',
    required: false,
    type: String,
    example: 'EUR',
    description: 'Optional display currency for converted subscription prices',
  })
  @ApiResponse({ status: 200, description: 'Subscription prices retrieved' })
  listSubscriptionPrices(@Query('currency') currency?: string) {
    return this.adminService.listSubscriptionPrices(currency);
  }

  @Patch('subscription-prices/:id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a subscription price' })
  @ApiResponse({ status: 200, description: 'Subscription price updated' })
  updateSubscriptionPrice(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionPriceDto,
  ) {
    if (!user?.sub) throw new UnauthorizedException('Missing admin context');
    return this.adminService.updateSubscriptionPrice(user.sub, id, dto);
  }

  @Delete('subscription-prices/:id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a subscription price' })
  @ApiResponse({ status: 200, description: 'Subscription price deleted' })
  deleteSubscriptionPrice(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
  ) {
    if (!user?.sub) throw new UnauthorizedException('Missing admin context');
    return this.adminService.deleteSubscriptionPrice(id);
  }

  @Post('tenants/:tenantId/subscription-vouchers')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a tenant-scoped subscription voucher' })
  @ApiResponse({ status: 201, description: 'Subscription voucher created' })
  createSubscriptionVoucher(
    @CurrentUser() user: AuthUser | undefined,
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateSubscriptionVoucherDto,
  ) {
    if (!user?.sub) throw new UnauthorizedException('Missing admin context');
    return this.adminService.createSubscriptionVoucher(user.sub, tenantId, dto);
  }

  @Get('tenants/:tenantId/subscription-vouchers')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List tenant-scoped subscription vouchers' })
  @ApiResponse({ status: 200, description: 'Subscription vouchers retrieved' })
  listSubscriptionVouchers(@Param('tenantId') tenantId: string) {
    return this.adminService.listSubscriptionVouchers(tenantId);
  }

  @Get('subscription-vouchers')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List subscription vouchers across all tenants' })
  @ApiResponse({
    status: 200,
    description: 'Subscription vouchers across all tenants retrieved',
  })
  listAllSubscriptionVouchers() {
    return this.adminService.listAllSubscriptionVouchers();
  }

  @Patch('subscription-vouchers/:id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a tenant-scoped subscription voucher' })
  @ApiResponse({ status: 200, description: 'Subscription voucher updated' })
  updateSubscriptionVoucher(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionVoucherDto,
  ) {
    return this.adminService.updateSubscriptionVoucher(id, dto);
  }

  @Delete('subscription-vouchers/:id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a tenant-scoped subscription voucher' })
  @ApiResponse({ status: 200, description: 'Subscription voucher deleted' })
  deleteSubscriptionVoucher(@Param('id') id: string) {
    return this.adminService.deleteSubscriptionVoucher(id);
  }
}
