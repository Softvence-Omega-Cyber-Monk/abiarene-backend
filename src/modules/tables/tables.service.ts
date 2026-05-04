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
      return await this.prisma.table.create({ data: { ...dto, tenantId } as any });
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
      include: {
        menuItems: {
          include: {
            menuItem: true,
          },
        },
      } as any,
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
        select: {
          menuItems: {
            include: {
              menuItem: true,
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      })
      .then((table) => table?.menuItems ?? []);
  }

  async setItems(tenantId: string, id: string, dto: SetTableItemsDto) {
    const table = await this.prisma.table.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!table) {
      throw new BadRequestException('Table not found for this tenant');
    }

    const items = await this.prisma.menuItem.findMany({
      where: {
        tenantId,
        id: { in: dto.itemIds },
      } as any,
      select: { id: true },
    });

    if (items.length !== dto.itemIds.length) {
      throw new BadRequestException(
        'One or more items do not belong to this tenant',
      );
    }

    await this.prisma.table.update({
      where: { id },
      data: {
        menuItems: {
          deleteMany: {},
          create: dto.itemIds.map((itemId) => ({
            menuItemId: itemId,
          })),
        },
      },
    });

    return this.listItems(tenantId, id);
  }
}
