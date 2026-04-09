import { Controller, Get, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { AdminService } from './admin.service.js';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @Roles('admin')
  dashboard(@CurrentUser() user: AuthUser | undefined) {
    if (!user?.tenantId) throw new UnauthorizedException('Missing tenant context');
    return this.adminService.dashboard(user.tenantId);
  }
}
