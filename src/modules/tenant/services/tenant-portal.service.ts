import { Injectable } from '@nestjs/common';
import {
  InitiateSubscriptionPaymentDto,
  ListTenantRolesDto,
  UpdateTenantDto,
} from '../tenant.dto.js';
import { TenantSubscriptionService } from '../tenant-subscription.service.js';
import { TenantService } from '../tenant.service.js';

@Injectable()
export class TenantPortalService {
  constructor(
    private readonly tenantService: TenantService,
    private readonly subscriptionService: TenantSubscriptionService,
  ) {}

  read(tenantId: string) {
    return this.tenantService.read(tenantId, tenantId);
  }

  overview(tenantId: string) {
    return this.tenantService.getManagerOverview(tenantId);
  }

  update(tenantId: string, dto: UpdateTenantDto) {
    return this.tenantService.update(tenantId, tenantId, dto);
  }

  getSubscription(tenantId: string) {
    return this.subscriptionService.getSubscriptionDetails(tenantId);
  }

  initiateSubscriptionPayment(
    tenantId: string,
    userId: string,
    dto: InitiateSubscriptionPaymentDto,
  ) {
    return this.subscriptionService.initiateSubscriptionPayment(
      tenantId,
      userId,
      dto,
    );
  }

  getSubscriptionPaymentStatus(tenantId: string, reference: string) {
    return this.subscriptionService.getSubscriptionPaymentStatus(
      tenantId,
      reference,
    );
  }

  listRoles(tenantId: string, dto: ListTenantRolesDto) {
    return this.tenantService.listRoles(tenantId, dto);
  }
}
