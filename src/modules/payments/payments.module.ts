import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MtnMomoPaymentProviderService } from './mtn-momo-payment-provider.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentProvidersService } from './payment-providers.service.js';
import { PaystackPaymentProviderService } from './paystack-payment-provider.service.js';
import { PaymentsService } from './payments.service.js';
import { StripePaymentProviderService } from './stripe-payment-provider.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentProvidersService,
    StripePaymentProviderService,
    MtnMomoPaymentProviderService,
    PaystackPaymentProviderService,
  ],
  exports: [
    PaymentsService,
    PaymentProvidersService,
    StripePaymentProviderService,
    MtnMomoPaymentProviderService,
    PaystackPaymentProviderService,
  ],
})
export class PaymentsModule {}
