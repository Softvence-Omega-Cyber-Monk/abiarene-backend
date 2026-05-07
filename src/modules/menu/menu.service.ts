import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateMenuDto, ListMenuDto, UpdateMenuDto } from './menu.dto.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateMenuDto) {
    return this.prisma.menuItem.create({
      data: {
        tenantId,
        image: dto.image,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        options: dto.options ?? [],
        price: dto.price,
        isActive: dto.isActive ?? true,
      } as any,
    });
  }

  async list(tenantId: string, dto: ListMenuDto) {
    const where = {
      tenantId,
      OR: dto.search
        ? [
            { name: { contains: dto.search, mode: 'insensitive' as const } },
            { category: { contains: dto.search, mode: 'insensitive' as const } },
          ]
        : undefined,
    } as any;

    const [items, total] = await Promise.all([
      this.prisma.menuItem.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' } as any,
      }),
      this.prisma.menuItem.count({ where }),
    ]);

    return buildPaginatedResponse(items, dto.page, dto.limit, total);
  }

  read(tenantId: string, id: string) {
    return this.prisma.menuItem.findFirst({
      where: { tenantId, id } as any,
      include: {
        menuSelections: {
          include: {
            menu: true,
          },
        },
      } as any,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateMenuDto) {
    await this.prisma.menuItem.updateMany({
      where: { tenantId, id } as any,
      data: {
        image: dto.image,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        options: dto.options,
        price: dto.price,
        isActive: dto.isActive,
      } as any,
    });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.menuItem.deleteMany({ where: { tenantId, id } as any });
  }
}
