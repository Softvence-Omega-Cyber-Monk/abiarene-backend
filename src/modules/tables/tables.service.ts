import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CreateTablesDto,
  ListTablesDto,
  SetTableItemsDto,
  UpdateTablesDto,
} from './tables.dto.js';

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateTablesDto) {
    try {
      const table = await this.prisma.table.create({ data: { ...dto, tenantId } as any });
      return this.read(tenantId, table.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Table number already exists for this tenant',
        );
      }

      throw error;
    }
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
    return this.prisma.table.findFirst({
      where: { tenantId, id } as any,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTablesDto) {
    await this.prisma.table.updateMany({ where: { tenantId, id } as any, data: dto as any });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.table.deleteMany({ where: { tenantId, id } as any });
  }

  listItems(tenantId: string, id: string) {
    return this.prisma.table
      .findFirst({
        where: { id, tenantId } as any,
        select: { id: true },
      })
      .then(async (table) => {
        if (!table) {
          throw new BadRequestException('Table not found for this tenant');
        }

        const menu = await this.getMenu(tenantId);
        return menu?.items ?? [];
      });
  }

  async setMenu(tenantId: string, dto: SetTableItemsDto) {
    const uniqueItemIds = [...new Set(dto.itemIds)];

    const items = await this.prisma.menuItem.findMany({
      where: {
        tenantId,
        id: { in: uniqueItemIds },
      } as any,
      select: { id: true },
    });

    if (items.length !== uniqueItemIds.length) {
      throw new BadRequestException(
        'One or more items do not belong to this tenant',
      );
    }

    const existingMenu = await this.prisma.menu.findFirst({
      where: { tenantId },
      select: { id: true },
    });

    if (existingMenu) {
      const existingSelections = await this.prisma.menuSelection.findMany({
        where: { menuId: existingMenu.id } as any,
        select: { itemId: true },
      });

      const existingItemIds = new Set(
        existingSelections.map((selection) => selection.itemId),
      );
      const itemIdsToAdd = uniqueItemIds.filter(
        (itemId) => !existingItemIds.has(itemId),
      );

      await this.prisma.menu.update({
        where: { id: existingMenu.id },
        data: {
          name: dto.name,
          items: {
            create: itemIdsToAdd.map((itemId) => ({
              itemId,
            })),
          },
        },
      });
    } else {
      await this.prisma.menu.create({
        data: {
          tenantId,
          name: dto.name,
          items: {
            create: uniqueItemIds.map((itemId) => ({
              itemId,
            })),
          },
        },
      });
    }

    return this.getMenu(tenantId);
  }

  async removeMenuItem(tenantId: string, itemId: string) {
    const menu = await this.prisma.menu.findFirst({
      where: { tenantId },
      select: { id: true },
    });

    if (!menu) {
      throw new BadRequestException('Shared menu not found for this tenant');
    }

    const selection = await this.prisma.menuSelection.findFirst({
      where: {
        menuId: menu.id,
        itemId,
      } as any,
      select: { id: true },
    });

    if (!selection) {
      throw new BadRequestException('Item is not assigned to the shared menu');
    }

    await this.prisma.menuSelection.delete({
      where: { id: selection.id },
    });

    return this.getMenu(tenantId);
  }

  getMenu(tenantId: string) {
    return this.prisma.menu.findFirst({
      where: { tenantId },
      include: {
        items: {
          include: {
            item: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }
}
