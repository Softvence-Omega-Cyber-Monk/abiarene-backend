import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
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
  @ApiOperation({ summary: 'Create ticket' })
  @ApiResponse({ status: 201, description: 'Ticket created' })
  create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreateTicketsDto) {
    return this.service.create(this.tenantId(user), dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tickets' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved' })
  list(@CurrentUser() user: AuthUser | undefined, @Query() dto: ListTicketsDto) {
    return this.service.list(this.tenantId(user), dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by ID' })
  @ApiResponse({ status: 200, description: 'Ticket retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.tenantId(user), id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ticket by ID' })
  @ApiResponse({ status: 200, description: 'Ticket updated' })
  update(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateTicketsDto,
  ) {
    return this.service.update(this.tenantId(user), id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete ticket by ID' })
  @ApiResponse({ status: 200, description: 'Ticket deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.tenantId(user), id);
  }

  @Post(':id/bump-to-ready')
  @ApiOperation({ summary: 'Mark ticket as ready' })
  @ApiResponse({ status: 201, description: 'Ticket marked ready' })
  bumpToReady(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.bumpToReady(this.tenantId(user), id);
  }
}
