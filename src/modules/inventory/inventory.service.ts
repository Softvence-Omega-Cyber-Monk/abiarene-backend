import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateInventoryDto, ListInventoryDto, UpdateInventoryDto } from './inventory.dto.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateInventoryDto) {
    return this.prisma.product.create({ data: { ...dto, tenantId } as any });
  }

  list(tenantId: string, dto: ListInventoryDto) {
    return this.prisma.product.findMany({
      where: { tenantId } as any,
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      orderBy: { createdAt: 'desc' } as any,
    });
  }

  read(tenantId: string, id: string) {
    return this.prisma.product.findFirst({ where: { tenantId, id } as any });
  }

  async update(tenantId: string, id: string, dto: UpdateInventoryDto) {
    await this.prisma.product.updateMany({ where: { tenantId, id } as any, data: dto as any });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.product.deleteMany({ where: { tenantId, id } as any });
  }
}
