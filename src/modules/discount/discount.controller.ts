import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { CreateDiscountDto, ListDiscountDto, UpdateDiscountDto } from './discount.dto.js';
import { DiscountService } from './discount.service.js';

@ApiTags('Discount')
@ApiBearerAuth()
@Controller('discount')
export class DiscountController {
  constructor(private readonly service: DiscountService) {}

  private tenantId(user?: AuthUser) {
    if (!user?.tenantId) throw new UnauthorizedException('Missing tenant context');
    return user.tenantId;
  }

  @Post()
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Create discount request' })
  @ApiResponse({ status: 201, description: 'Discount request created' })
  create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateDiscountDto) {
    if (!user?.sub) throw new UnauthorizedException('Missing user context');
    return this.service.create(this.tenantId(user), user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List discount requests' })
  @ApiResponse({ status: 200, description: 'Discount requests retrieved' })
  list(@CurrentUser() user: AuthUser | undefined, @Query() dto: ListDiscountDto) {
    return this.service.list(this.tenantId(user), dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get discount request by ID' })
  @ApiResponse({ status: 200, description: 'Discount request retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.tenantId(user), id);
  }

  @Patch(':id')
  @Roles('manager', 'admin')
  @ApiOperation({ summary: 'Update discount request by ID' })
  @ApiResponse({ status: 200, description: 'Discount request updated' })
  update(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string, @Body() dto: UpdateDiscountDto) {
    return this.service.update(this.tenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete discount request by ID' })
  @ApiResponse({ status: 200, description: 'Discount request deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.tenantId(user), id);
  }
}
