import {
  Body,
  Controller,
  Get,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { AdminService } from './admin.service.js';
import { AdminSignupDto, AdminLoginDto } from './admin.dto.js';

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

  @Get('dashboard')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get admin dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  dashboard(@CurrentUser() user: AuthUser | undefined) {
    if (!user?.sub) throw new UnauthorizedException('Missing tenant context');
    return this.adminService.dashboard(user.tenantId);
  }
}
