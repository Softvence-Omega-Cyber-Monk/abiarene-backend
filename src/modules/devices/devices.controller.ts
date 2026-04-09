import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { CreateDevicesDto, ListDevicesDto, UpdateDevicesDto } from './devices.dto.js';
import { DevicesService } from './devices.service.js';

@ApiTags('Devices')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly service: DevicesService) {}

  private tenantId(user?: AuthUser) {
    if (!user?.tenantId) throw new UnauthorizedException('Missing tenant context');
    return user.tenantId;
  }

  @Post()
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Create device' })
  @ApiResponse({ status: 201, description: 'Device created' })
  create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateDevicesDto) {
    return this.service.create(this.tenantId(user), dto);
  }

  @Get()
  @ApiOperation({ summary: 'List devices' })
  @ApiResponse({ status: 200, description: 'Devices retrieved' })
  list(@CurrentUser() user: AuthUser | undefined, @Query() dto: ListDevicesDto) {
    return this.service.list(this.tenantId(user), dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get device by ID' })
  @ApiResponse({ status: 200, description: 'Device retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.tenantId(user), id);
  }

  @Patch(':id')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Update device by ID' })
  @ApiResponse({ status: 200, description: 'Device updated' })
  update(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string, @Body() dto: UpdateDevicesDto) {
    return this.service.update(this.tenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete device by ID' })
  @ApiResponse({ status: 200, description: 'Device deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.tenantId(user), id);
  }
}
