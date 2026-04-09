import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateSupportDto, ListSupportDto, UpdateSupportDto } from './support.dto.js';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateSupportDto) {
    return this.prisma.supportTicket.create({ data: { ...dto, tenantId } as any });
  }

  list(tenantId: string, dto: ListSupportDto) {
    return this.prisma.supportTicket.findMany({
      where: { tenantId } as any,
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      orderBy: { createdAt: 'desc' } as any,
    });
  }

  read(tenantId: string, id: string) {
    return this.prisma.supportTicket.findFirst({ where: { tenantId, id } as any });
  }

  async update(tenantId: string, id: string, dto: UpdateSupportDto) {
    await this.prisma.supportTicket.updateMany({ where: { tenantId, id } as any, data: dto as any });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.supportTicket.deleteMany({ where: { tenantId, id } as any });
  }
}
