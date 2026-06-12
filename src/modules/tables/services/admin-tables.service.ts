import { Injectable } from '@nestjs/common';
import {
  CashierCheckoutDto,
  CreateTablesDto,
  ListTablesDto,
  SetTableItemsDto,
  UpdateTablesDto,
} from '../tables.dto.js';
import { TenantTablesService } from './tenant-tables.service.js';

@Injectable()
export class AdminTablesService {
  constructor(private readonly tenantTablesService: TenantTablesService) {}

  create(tenantId: string, dto: CreateTablesDto) {
    return this.tenantTablesService.create(tenantId, dto);
  }

  list(tenantId: string, dto: ListTablesDto) {
    return this.tenantTablesService.list(tenantId, dto);
  }

  read(tenantId: string, id: string) {
    return this.tenantTablesService.read(tenantId, id);
  }

  update(tenantId: string, id: string, dto: UpdateTablesDto) {
    return this.tenantTablesService.update(tenantId, id, dto);
  }

  delete(tenantId: string, id: string) {
    return this.tenantTablesService.delete(tenantId, id);
  }

  getMenu(tenantId: string) {
    return this.tenantTablesService.getMenu(tenantId);
  }

  setMenu(tenantId: string, dto: SetTableItemsDto) {
    return this.tenantTablesService.setMenu(tenantId, dto);
  }

  removeMenuItem(tenantId: string, itemId: string) {
    return this.tenantTablesService.removeMenuItem(tenantId, itemId);
  }

  listItems(tenantId: string, id: string) {
    return this.tenantTablesService.listItems(tenantId, id);
  }

  getCashierSummary(tenantId: string, id: string) {
    return this.tenantTablesService.getCashierSummary(tenantId, id);
  }

  completeCashierCheckout(tenantId: string, id: string, dto: CashierCheckoutDto) {
    return this.tenantTablesService.completeCashierCheckout(tenantId, id, dto);
  }
}
