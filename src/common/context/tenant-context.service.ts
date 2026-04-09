import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

type TenantStore = { tenantId: string };

@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantStore>();

  runWithTenant<T>(tenantId: string, callback: () => T): T {
    return this.als.run({ tenantId }, callback);
  }

  setTenant(tenantId: string): void {
    this.als.enterWith({ tenantId });
  }

  getTenantId(): string | undefined {
    return this.als.getStore()?.tenantId;
  }
}
