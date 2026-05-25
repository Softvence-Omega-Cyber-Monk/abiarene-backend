import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import type { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { AuthService } from './auth.service.js';
import {
  LoginDto,
  RegisterSupervisorDto,
  TenantResponse,
  UserResponse,
} from './auth.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('tenants')
  @Public()
  @ApiOperation({ summary: 'Get all available tenants' })
  @ApiResponse({
    status: 200,
    description: 'List of tenants',
    type: [TenantResponse],
  })
  getTenants() {
    return this.authService.getTenants();
  }

  @Get('tenants/:tenantId/users')
  @Public()
  @ApiOperation({ summary: 'Get users and roles for a tenant' })
  @ApiResponse({
    status: 200,
    description: 'List of users with roles',
    type: [UserResponse],
  })
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

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Create a supervisor account before tenant onboarding' })
  @ApiResponse({ status: 201, description: 'Supervisor account created' })
  @ApiResponse({ status: 400, description: 'Email already exists' })
  register(@Body() dto: RegisterSupervisorDto) {
    return this.authService.registerSupervisor(dto);
  }

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current admin or staff user' })
  @ApiResponse({ status: 201, description: 'Logout successful' })
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user);
  }
}
