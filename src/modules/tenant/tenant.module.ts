import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { TenantController } from './tenant.controller.js';
import { TenantSubscriptionService } from './tenant-subscription.service.js';
import { TenantService } from './tenant.service.js';

@Module({
  imports: [PaymentsModule, NotificationsModule],
  controllers: [TenantController],
  providers: [TenantService, TenantSubscriptionService],
  exports: [TenantService, TenantSubscriptionService],
})
export class TenantModule {}
