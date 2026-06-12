import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateMenuDto, ListMenuDto, UpdateMenuDto } from './menu.dto.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  private async getTenantCurrencyCode(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { currencyCode: true },
    });

    return tenant?.currencyCode;
  }

  private withCurrencyCode<T>(record: T, currencyCode?: string) {
    return {
      ...(record as object),
      currencyCode,
    } as T & { currencyCode?: string };
  }

  async create(tenantId: string, dto: CreateMenuDto) {
    const [item, currencyCode] = await Promise.all([
      this.prisma.menuItem.create({
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
      }),
      this.getTenantCurrencyCode(tenantId),
    ]);

    return this.withCurrencyCode(item, currencyCode);
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

    const [items, total, currencyCode] = await Promise.all([
      this.prisma.menuItem.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' } as any,
      }),
      this.prisma.menuItem.count({ where }),
      this.getTenantCurrencyCode(tenantId),
    ]);

    return buildPaginatedResponse(
      items.map((item) => this.withCurrencyCode(item, currencyCode)),
      dto.page,
      dto.limit,
      total,
    );
  }

  async read(tenantId: string, id: string) {
    const [item, currencyCode] = await Promise.all([
      this.prisma.menuItem.findFirst({
        where: { tenantId, id } as any,
        include: {
          menuSelections: {
            include: {
              menu: true,
            },
          },
        } as any,
      }),
      this.getTenantCurrencyCode(tenantId),
    ]);

    return item ? this.withCurrencyCode(item, currencyCode) : item;
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
