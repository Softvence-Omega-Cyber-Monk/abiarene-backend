import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateTenantDto, ListTenantDto, UpdateTenantDto } from './tenant.dto.js';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  create(_tenantId: string, dto: CreateTenantDto) {
    return this.prisma.tenant.create({ data: { name: dto.name ?? 'New Tenant' } as any });
  }

  list(tenantId: string, dto: ListTenantDto) {
    return this.prisma.tenant.findMany({
      where: { id: tenantId },
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  read(tenantId: string, id: string) {
    if (id !== tenantId) {
      return null;
    }
    return this.prisma.tenant.findFirst({ where: { id } });
  }

  async update(tenantId: string, id: string, dto: UpdateTenantDto) {
    if (id !== tenantId) {
      return null;
    }
    await this.prisma.tenant.update({ where: { id }, data: dto as any });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    if (id !== tenantId) {
      return { count: 0 };
    }
    return this.prisma.tenant.deleteMany({ where: { id } });
  }
}
