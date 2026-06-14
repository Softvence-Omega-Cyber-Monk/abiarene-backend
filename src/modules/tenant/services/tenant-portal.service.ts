import { Injectable } from '@nestjs/common';
import {
  CreateTenantDto,
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

  async read(tenantId: string, currency?: string) {
    const [tenant, subscription] = await Promise.all([
      this.tenantService.read(tenantId, tenantId),
      this.subscriptionService.getSubscriptionDetails(tenantId, currency),
    ]);

    if (!tenant) {
      return tenant;
    }

    return {
      ...tenant,
      displaySubscriptionFee: subscription.subscription.fee,
      displaySubscriptionFeeCurrency: subscription.subscription.feeCurrency,
      subscriptionExchangeValue: subscription.subscription.exchangeValue,
    };
  }

  createForSupervisor(userId: string, dto: CreateTenantDto) {
    return this.tenantService.createForSupervisor(userId, dto);
  }

  overview(tenantId: string) {
    return this.tenantService.getManagerOverview(tenantId);
  }

  dailySalesHistory(tenantId: string, days?: number) {
    return this.tenantService.getDailySalesHistory(tenantId, days);
  }

  totalTransactions(tenantId: string) {
    return this.tenantService.getTotalTransactionsSummary(tenantId);
  }

  activeDiscounts(tenantId: string) {
    return this.tenantService.getActiveDiscountSummary(tenantId);
  }

  update(tenantId: string, dto: UpdateTenantDto) {
    return this.tenantService.update(tenantId, tenantId, dto);
  }

  getSubscription(tenantId: string, currency?: string) {
    return this.subscriptionService.getSubscriptionDetails(tenantId, currency);
  }

  listSubscriptionVouchers(tenantId: string) {
    return this.subscriptionService.listAvailableVouchers(tenantId);
  }

  initiateSubscriptionPayment(
    tenantId: string,
    userId: string,
    dto: InitiateSubscriptionPaymentDto,
    callbackBaseUrl?: string | null,
  ) {
    return this.subscriptionService.initiateSubscriptionPayment(
      tenantId,
      userId,
      dto,
      callbackBaseUrl,
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
