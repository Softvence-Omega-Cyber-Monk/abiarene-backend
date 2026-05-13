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
  CreateUsersDto,
  ListUsersDto,
  UpdateMyProfileDto,
  UpdateUsersDto,
} from './users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private tenantId(user?: AuthUser) {
    if (!user?.tenantId)
      throw new UnauthorizedException('Missing tenant context');
    return user.tenantId;
  }

  private listDto(page: string, limit: string, search?: string): ListUsersDto {
    return {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
    };
  }

  @Post()
  @Roles('manager')
  @ApiOperation({ summary: 'Create a user under current tenant' })
  @ApiResponse({ status: 201, description: 'User created' })
  create(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: CreateUsersDto,
  ) {
    return this.usersService.createForTenant(this.tenantId(user), dto);
  }

  @Get()
  @Roles('manager')
  @ApiOperation({ summary: 'List users under current tenant' })
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'john' })
  list(
    @CurrentUser() user: AuthUser | undefined,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
  ) {
    return this.usersService.listForTenant(
      this.tenantId(user),
      this.listDto(page, limit, search),
    );
  }

  @Patch('me')
  @Roles('manager')
  @ApiOperation({ summary: 'Manager update own profile under current tenant' })
  @ApiResponse({ status: 200, description: 'Manager profile updated' })
  updateMyProfile(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: UpdateMyProfileDto,
  ) {
    if (!user?.sub) {
      throw new UnauthorizedException('Missing user context');
    }

    return this.usersService.updateMyProfile(this.tenantId(user), user.sub, dto);
  }

  @Get(':id')
  @Roles('manager')
  @ApiOperation({ summary: 'Get user by ID under current tenant' })
  @ApiResponse({ status: 200, description: 'User retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.usersService.readForTenant(this.tenantId(user), id);
  }

  @Patch(':id')
  @Roles('manager')
  @ApiOperation({ summary: 'Update user by ID under current tenant' })
  @ApiResponse({ status: 200, description: 'User updated' })
  update(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateUsersDto,
  ) {
    return this.usersService.updateForTenant(this.tenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  @ApiOperation({ summary: 'Delete user by ID under current tenant' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.usersService.deleteForTenant(this.tenantId(user), id);
  }

  @Post('tenant/:tenantId')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin create a user under any tenant' })
  @ApiResponse({ status: 201, description: 'User created' })
  createForTenant(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateUsersDto,
  ) {
    return this.usersService.createForTenant(tenantId, dto);
  }

  @Get('tenant/:tenantId')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin list users under any tenant' })
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  listForTenant(@Param('tenantId') tenantId: string, @Query() dto: ListUsersDto) {
    return this.usersService.listForTenant(tenantId, dto);
  }

  @Get('tenant/:tenantId/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin get user by ID under any tenant' })
  @ApiResponse({ status: 200, description: 'User retrieved' })
  readForTenant(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.usersService.readForTenant(tenantId, id);
  }

  @Patch('tenant/:tenantId/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin update user by ID under any tenant' })
  @ApiResponse({ status: 200, description: 'User updated' })
  updateForTenant(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUsersDto,
  ) {
    return this.usersService.updateForTenant(tenantId, id, dto);
  }

  @Delete('tenant/:tenantId/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin delete user by ID under any tenant' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  deleteForTenant(@Param('tenantId') tenantId: string, @Param('id') id: string) {
    return this.usersService.deleteForTenant(tenantId, id);
  }
}
