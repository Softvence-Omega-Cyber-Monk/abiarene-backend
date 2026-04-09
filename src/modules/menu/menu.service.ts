import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateMenuDto, ListMenuDto, UpdateMenuDto } from './menu.dto.js';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateMenuDto) {
    return this.prisma.menu.create({ data: { ...dto, tenantId } as any });
  }

  list(tenantId: string, dto: ListMenuDto) {
    return this.prisma.menu.findMany({
      where: { tenantId } as any,
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      orderBy: { createdAt: 'desc' } as any,
    });
  }

  read(tenantId: string, id: string) {
    return this.prisma.menu.findFirst({ where: { tenantId, id } as any });
  }

  async update(tenantId: string, id: string, dto: UpdateMenuDto) {
    await this.prisma.menu.updateMany({ where: { tenantId, id } as any, data: dto as any });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.menu.deleteMany({ where: { tenantId, id } as any });
  }
}
