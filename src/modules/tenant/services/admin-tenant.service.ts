import { Injectable } from '@nestjs/common';
import {
  ListTenantDto,
  ListTenantRolesDto,
  UpdateTenantRolesDto,
  UpdateTenantStatusDto,
} from '../tenant.dto.js';
import { TenantService } from '../tenant.service.js';

@Injectable()
export class AdminTenantService {
  constructor(private readonly tenantService: TenantService) {}

  listAll(dto: ListTenantDto) {
    return this.tenantService.listAll(dto);
  }

  listRoles(tenantId: string, dto: ListTenantRolesDto) {
    return this.tenantService.listRoles(tenantId, dto);
  }

  updateRoles(tenantId: string, dto: UpdateTenantRolesDto) {
    return this.tenantService.updateRoles(tenantId, dto);
  }

  updateStatus(tenantId: string, dto: UpdateTenantStatusDto) {
    return this.tenantService.updateStatus(tenantId, dto.status);
  }
}
