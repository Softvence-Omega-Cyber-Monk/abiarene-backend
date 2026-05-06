import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { CreateTicketsDto, ListTicketsDto, UpdateTicketsDto } from './tickets.dto.js';
import { TicketsService } from './tickets.service.js';

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly service: TicketsService) {}
  private tenantId(user?: AuthUser) {
    if (!user?.tenantId) throw new UnauthorizedException('Missing tenant context');
    return user.tenantId;
  }

  @Post()
  @Roles('manager', 'server')
  @ApiOperation({ summary: 'Create ticket under your current tenant' })
  @ApiResponse({ status: 201, description: 'Ticket created' })
  create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateTicketsDto) {
    return this.service.create(this.tenantId(user), dto);
  }

  @Get()
  @Roles('manager', 'server', 'kitchen')
  @ApiOperation({ summary: 'List tickets under your current tenant' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved' })
  list(@CurrentUser() user: AuthUser | undefined, @Query() dto: ListTicketsDto) {
    return this.service.list(this.tenantId(user), dto);
  }

  @Get('kitchen-board')
  @Roles('kitchen', 'manager')
  @ApiOperation({ summary: 'List all active and ready kitchen tickets under your current tenant' })
  @ApiResponse({ status: 200, description: 'Kitchen board tickets retrieved for your current tenant' })
  kitchenBoard(@CurrentUser() user: AuthUser | undefined) {
    return this.service.kitchenBoard(this.tenantId(user));
  }

  @Get(':id')
  @Roles('manager', 'server', 'kitchen')
  @ApiOperation({ summary: 'Get ticket by ID under your current tenant' })
  @ApiResponse({ status: 200, description: 'Ticket retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.tenantId(user), id);
  }

  @Patch(':id')
  @Roles('manager', 'server', 'kitchen')
  @ApiOperation({ summary: 'Update ticket by ID under your current tenant' })
  @ApiResponse({ status: 200, description: 'Ticket updated' })
  update(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateTicketsDto,
  ) {
    return this.service.update(this.tenantId(user), id, dto);
  }

  @Delete(':id')
  @Roles('manager')
  @ApiOperation({ summary: 'Delete ticket by ID under your current tenant' })
  @ApiResponse({ status: 200, description: 'Ticket deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.tenantId(user), id);
  }

  @Post(':id/bump-to-ready')
  @Roles('kitchen', 'manager')
  @ApiOperation({ summary: 'Mark a kitchen ticket as ready under your current tenant' })
  @ApiResponse({ status: 201, description: 'Kitchen ticket marked ready' })
  bumpToReady(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.bumpToReady(this.tenantId(user), id);
  }

  @Post(':id/archive')
  @Roles('server', 'manager', 'kitchen')
  @ApiOperation({ summary: 'Archive a kitchen ticket under your current tenant' })
  @ApiResponse({ status: 201, description: 'Kitchen ticket archived' })
  archive(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.archive(this.tenantId(user), id);
  }
}
