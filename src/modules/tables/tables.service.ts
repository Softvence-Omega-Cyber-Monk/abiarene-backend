import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateTablesDto, ListTablesDto, UpdateTablesDto } from './tables.dto.js';

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateTablesDto) {
    return this.prisma.table.create({ data: { ...dto, tenantId } as any });
  }

  list(tenantId: string, dto: ListTablesDto) {
    return this.prisma.table.findMany({
      where: { tenantId } as any,
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      orderBy: { createdAt: 'desc' } as any,
    });
  }

  read(tenantId: string, id: string) {
    return this.prisma.table.findFirst({ where: { tenantId, id } as any });
  }

  async update(tenantId: string, id: string, dto: UpdateTablesDto) {
    await this.prisma.table.updateMany({ where: { tenantId, id } as any, data: dto as any });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.table.deleteMany({ where: { tenantId, id } as any });
  }
}
