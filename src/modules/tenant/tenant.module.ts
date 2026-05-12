import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module.js';
import { TenantController } from './tenant.controller.js';
import { TenantSubscriptionService } from './tenant-subscription.service.js';
import { TenantService } from './tenant.service.js';

@Module({
  imports: [PaymentsModule],
  controllers: [TenantController],
  providers: [TenantService, TenantSubscriptionService],
  exports: [TenantService, TenantSubscriptionService],
})
export class TenantModule {}
