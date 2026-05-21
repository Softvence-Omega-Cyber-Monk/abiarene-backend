import {
  Body,
  Controller,
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
  CreateSupportDto,
  CreateSupportMessageDto,
  ListSupportDto,
  UpdateSupportStatusDto,
} from './support.dto.js';
import { SupportService } from './support.service.js';

@ApiTags('Support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly service: SupportService) {}

  private currentUser(user?: AuthUser) {
    if (!user?.sub || !user?.role) {
      throw new UnauthorizedException('Missing user context');
    }

    return user;
  }

  @Post()
  @Roles('manager', 'supervisor')
  @ApiOperation({ summary: 'Create support issue under your current tenant' })
  @ApiResponse({ status: 201, description: 'Support issue created with OPEN status and sent to admin queue' })
  create(
    @CurrentUser() user: AuthUser | undefined,
    @Body() dto: CreateSupportDto,
  ) {
    return this.service.create(this.currentUser(user), dto);
  }

  @Get()
  @Roles('manager', 'supervisor', 'admin')
  @ApiOperation({ summary: 'List support issues for your role scope' })
  @ApiResponse({ status: 200, description: 'Support issues retrieved' })
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  @ApiQuery({ name: 'status', required: false, enum: ['OPEN', 'CLOSED'] })
  list(
    @CurrentUser() user: AuthUser | undefined,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('status') status?: 'OPEN' | 'CLOSED',
  ) {
    return this.service.list(this.currentUser(user), {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status,
    } as ListSupportDto);
  }

  @Get(':id')
  @Roles('manager', 'supervisor', 'admin')
  @ApiOperation({ summary: 'Get support issue details with conversation messages' })
  @ApiResponse({ status: 200, description: 'Support issue retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.currentUser(user), id);
  }

  @Post(':id/messages')
  @Roles('manager', 'supervisor', 'admin')
  @ApiOperation({ summary: 'Add a conversation message to a support issue' })
  @ApiResponse({ status: 201, description: 'Support message added' })
  addMessage(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: CreateSupportMessageDto,
  ) {
    return this.service.addMessage(this.currentUser(user), id, dto);
  }

  @Patch(':id/status')
  @Roles('admin')
  @ApiOperation({ summary: 'Admin update support issue status to OPEN or CLOSED' })
  @ApiResponse({ status: 200, description: 'Support issue status updated' })
  updateStatus(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateSupportStatusDto,
  ) {
    return this.service.updateStatus(this.currentUser(user), id, dto);
  }
}
