import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { CreatePaymentsDto, ListPaymentsDto, UpdatePaymentsDto } from './payments.dto.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  private tenantId(user?: AuthUser) {
    if (!user?.tenantId) throw new UnauthorizedException('Missing tenant context');
    return user.tenantId;
  }

  @Post()
  @ApiOperation({ summary: 'Create payment' })
  @ApiResponse({ status: 201, description: 'Payment created' })
  create(@CurrentUser() user: AuthUser | undefined, @Body() dto: CreatePaymentsDto) {
    return this.service.create(this.tenantId(user), dto);
  }

  @Get()
  @ApiOperation({ summary: 'List payments' })
  @ApiResponse({ status: 200, description: 'Payments retrieved' })
  list(@CurrentUser() user: AuthUser | undefined, @Query() dto: ListPaymentsDto) {
    return this.service.list(this.tenantId(user), dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment retrieved' })
  read(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.read(this.tenantId(user), id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment updated' })
  update(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentsDto,
  ) {
    return this.service.update(this.tenantId(user), id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete payment by ID' })
  @ApiResponse({ status: 200, description: 'Payment deleted' })
  delete(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.delete(this.tenantId(user), id);
  }

  @Post(':id/complete-payment')
  @ApiOperation({ summary: 'Complete payment' })
  @ApiResponse({ status: 201, description: 'Payment completed' })
  completePayment(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.service.completePayment(this.tenantId(user), id);
  }
}
