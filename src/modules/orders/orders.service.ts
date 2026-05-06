import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateOrdersDto, ListOrdersDto, OrderItemDto, UpdateOrdersDto } from './orders.dto.js';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly orderInclude = {
    table: true,
    items: {
      include: {
        menuItem: true,
      },
    },
    tickets: {
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                menuItem: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc' as const,
      },
    },
  };

  private async prepareOrderItems(tenantId: string, items: OrderItemDto[]) {
    if (items.length === 0) {
      throw new BadRequestException('Add at least one item to create an order');
    }

    const requestedItemIds = [...new Set(items.map((item) => item.itemId))];

    const menu = await this.prisma.menu.findFirst({
      where: { tenantId },
      include: {
        items: {
          where: {
            itemId: { in: requestedItemIds },
          },
          include: {
            item: {
              select: {
                id: true,
                options: true,
              },
            },
          },
        },
      },
    });

    if (!menu || menu.items.length !== requestedItemIds.length) {
      throw new BadRequestException(
        'One or more items are not assigned to the tenant menu',
      );
    }

    const menuItemsById = new Map(
      menu.items.map((selection) => [selection.item.id, selection.item]),
    );

    for (const item of items) {
      const menuItem = menuItemsById.get(item.itemId);
      if (!menuItem) {
        throw new BadRequestException('One or more items are not assigned to the tenant menu');
      }

      const selectedOptions = item.selectedOptions ?? [];
      const invalidOption = selectedOptions.find(
        (option) => !menuItem.options.includes(option),
      );

      if (invalidOption) {
        throw new BadRequestException(
          `Selected option "${invalidOption}" is not available for this item`,
        );
      }
    }

    return items.map((item) => ({
      menuItemId: item.itemId,
      quantity: item.quantity,
      notes: item.notes,
      selectedOptions: item.selectedOptions ?? [],
    }));
  }

  async create(tenantId: string, userId: string, dto: CreateOrdersDto) {
    const table = await this.prisma.table.findFirst({
      where: { id: dto.tableId, tenantId },
      select: { id: true },
    });

    if (!table) {
      throw new BadRequestException('Table not found for this tenant');
    }

    const orderItems = await this.prepareOrderItems(tenantId, dto.items);

    const order = await this.prisma.order.create({
      data: {
        tableId: dto.tableId,
        tenantId,
        createdBy: userId,
        items: {
          create: orderItems,
        },
      },
      include: this.orderInclude,
    });

    await this.prisma.table.updateMany({
      where: { id: dto.tableId, tenantId },
      data: { status: 'OCCUPIED' },
    });

    return this.read(tenantId, order.id);
  }

  list(tenantId: string, dto: ListOrdersDto) {
    return this.prisma.order.findMany({
      where: { tenantId },
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      include: this.orderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  read(tenantId: string, id: string) {
    return this.prisma.order.findFirst({
      where: { tenantId, id },
      include: this.orderInclude,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateOrdersDto) {
    await this.prisma.order.updateMany({ where: { tenantId, id }, data: dto as any });
    const order = await this.read(tenantId, id);

    if (order?.tableId && dto.status) {
      const nextTableStatus =
        dto.status === 'COMPLETED' || dto.status === 'CANCELLED'
          ? 'AVAILABLE'
          : 'OCCUPIED';

      await this.prisma.table.updateMany({
        where: { id: order.tableId, tenantId },
        data: { status: nextTableStatus },
      });
    }

    return order;
  }

  delete(tenantId: string, id: string) { return this.prisma.order.deleteMany({ where: { tenantId, id } }); }

  async sendToKitchen(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          select: { id: true },
        },
        tickets: {
          where: {
            status: {
              in: ['ACTIVE', 'READY'],
            },
          },
          select: { id: true },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found for this tenant');
    }

    if (order.items.length === 0) {
      throw new BadRequestException('Add at least one item before sending the order to kitchen');
    }

    if (order.tickets.length > 0) {
      throw new BadRequestException('This order already has an active kitchen ticket');
    }

    await this.prisma.ticket.create({
      data: {
        orderId: id,
        tenantId,
        items: {
          create: order.items.map((item) => ({
            orderItemId: item.id,
          })),
        },
      },
    });

    await this.prisma.order.updateMany({
      where: { tenantId, id },
      data: { status: 'IN_KITCHEN' },
    });

    return this.read(tenantId, id);
  }
}
