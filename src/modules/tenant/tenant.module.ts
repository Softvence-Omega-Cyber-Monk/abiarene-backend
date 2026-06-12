import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { AdminTenantController } from './controllers/admin-tenant.controller.js';
import { TenantPortalController } from './controllers/tenant-portal.controller.js';
import { AdminTenantService } from './services/admin-tenant.service.js';
import { TenantPortalService } from './services/tenant-portal.service.js';
import { TenantSubscriptionService } from './tenant-subscription.service.js';
import { TenantService } from './tenant.service.js';

@Module({
  imports: [PaymentsModule, NotificationsModule],
  controllers: [AdminTenantController, TenantPortalController],
  providers: [
    TenantService,
    TenantSubscriptionService,
    AdminTenantService,
    TenantPortalService,
  ],
  exports: [
    TenantService,
    TenantSubscriptionService,
    AdminTenantService,
    TenantPortalService,
  ],
})
export class TenantModule {}
