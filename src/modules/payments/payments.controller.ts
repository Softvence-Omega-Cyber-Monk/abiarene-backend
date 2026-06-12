import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
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

  private renderPaymentCallbackPage(input: {
    title: string;
    message: string;
    reference?: string;
  }) {
    const referenceLine = input.reference
      ? `<p><strong>Reference:</strong> ${input.reference}</p>`
      : '';

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${input.title}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; background: #111827; color: #f9fafb; }
      main { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      section { max-width: 480px; background: #1f2937; border-radius: 16px; padding: 32px; box-shadow: 0 16px 40px rgba(0,0,0,.28); text-align: center; }
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { margin: 8px 0; line-height: 1.5; }
      .muted { color: #9ca3af; font-size: 14px; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>${input.title}</h1>
        <p>${input.message}</p>
        ${referenceLine}
        <p class="muted">You can now return to the app.</p>
      </section>
    </main>
    <script>
      try {
        window.parent?.postMessage({ source: 'abiarene-payment-callback', reference: ${JSON.stringify(
          input.reference ?? null,
        )} }, '*');
      } catch (_) {}
      setTimeout(() => {
        try { window.close(); } catch (_) {}
      }, 1200);
    </script>
  </body>
</html>`;
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
  @ApiQuery({ name: 'page', required: false, type: String, example: '1' })
  @ApiQuery({ name: 'limit', required: false, type: String, example: '20' })
  list(
    @CurrentUser() user: AuthUser | undefined,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.service.list(this.tenantId(user), {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    } as ListPaymentsDto);
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

  @Get('callbacks/stripe/success')
  @Public()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Stripe subscription payment success callback page' })
  stripeSuccessCallback(@Query('reference') reference?: string) {
    return this.renderPaymentCallbackPage({
      title: 'Payment successful',
      message: 'Stripe payment completed successfully.',
      reference,
    });
  }

  @Get('callbacks/stripe/cancel')
  @Public()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Stripe subscription payment cancel callback page' })
  stripeCancelCallback(@Query('reference') reference?: string) {
    return this.renderPaymentCallbackPage({
      title: 'Payment cancelled',
      message: 'Stripe payment was cancelled.',
      reference,
    });
  }

  @Get('callbacks/paystack')
  @Public()
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Paystack subscription payment callback page' })
  paystackCallback(@Query('reference') reference?: string) {
    return this.renderPaymentCallbackPage({
      title: 'Payment processed',
      message: 'Paystack finished processing the payment.',
      reference,
    });
  }
}
