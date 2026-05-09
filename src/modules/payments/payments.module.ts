import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentProvidersService } from './payment-providers.service.js';
import { PaymentsService } from './payments.service.js';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentProvidersService],
  exports: [PaymentsService, PaymentProvidersService],
})
export class PaymentsModule {}
