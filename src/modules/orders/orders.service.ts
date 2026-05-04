import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AddOrderItemsDto, CreateOrdersDto, ListOrdersDto, UpdateOrdersDto } from './orders.dto.js';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, userId: string, dto: CreateOrdersDto) {
    const table = await this.prisma.table.findFirst({
      where: { id: dto.tableId, tenantId },
      select: { id: true },
    });

    if (!table) {
      throw new BadRequestException('Table not found for this tenant');
    }

    return this.prisma.order.create({
      data: { ...dto, tenantId, createdBy: userId },
      include: {
        table: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });
  }

  list(tenantId: string, dto: ListOrdersDto) {
    return this.prisma.order.findMany({
      where: { tenantId },
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      include: {
        table: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });
  }

  read(tenantId: string, id: string) {
    return this.prisma.order.findFirst({
      where: { tenantId, id },
      include: {
        table: true,
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateOrdersDto) {
    await this.prisma.order.updateMany({ where: { tenantId, id }, data: dto as any });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) { return this.prisma.order.deleteMany({ where: { tenantId, id } }); }

  async addItems(tenantId: string, id: string, dto: AddOrderItemsDto) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      select: { id: true, tableId: true },
    });

    if (!order) {
      throw new BadRequestException('Order not found for this tenant');
    }

    const requestedItemIds = [...new Set(dto.items.map((item) => item.itemId))];

    const table = await this.prisma.table.findFirst({
      where: {
        id: order.tableId,
        tenantId,
      },
      select: {
        menuItems: {
          where: {
            menuItemId: { in: requestedItemIds },
          },
          select: { menuItemId: true },
        },
      },
    });

    if (!table || table.menuItems.length !== requestedItemIds.length) {
      throw new BadRequestException(
        'One or more items are not assigned to this table',
      );
    }

    return this.prisma.orderItem.createMany({
      data: dto.items.map((item) => ({
        orderId: id,
        menuItemId: item.itemId,
        quantity: item.quantity,
        notes: item.notes,
      })),
    });
  }

  async sendToKitchen(tenantId: string, id: string) {
    await this.prisma.order.updateMany({ where: { tenantId, id }, data: { status: 'IN_KITCHEN' } });
    return this.read(tenantId, id);
  }
}
