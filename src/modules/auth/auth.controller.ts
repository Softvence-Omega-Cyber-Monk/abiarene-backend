import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import { LoginDto, TenantResponse, UserResponse } from './auth.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('tenants')
  @Public()
  @ApiOperation({ summary: 'Get all available tenants' })
  @ApiResponse({ status: 200, description: 'List of tenants', type: [TenantResponse] })
  getTenants() {
    return this.authService.getTenants();
  }

  @Get('tenants/:tenantId/users')
  @Public()
  @ApiOperation({ summary: 'Get users and roles for a tenant' })
  @ApiResponse({ status: 200, description: 'List of users with roles', type: [UserResponse] })
  getTenantUsers(@Param('tenantId') tenantId: string) {
    return this.authService.getTenantUsers(tenantId);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Authenticate admin or staff by email and PIN' })
  @ApiResponse({ status: 201, description: 'Authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid email or PIN' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
