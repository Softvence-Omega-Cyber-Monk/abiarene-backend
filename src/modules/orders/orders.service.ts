import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateOrdersDto, ListOrdersDto, OrderItemDto, UpdateOrdersDto } from './orders.dto.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
  ) {}

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

  private formatOrderListItem(order: {
    id: string;
    tenantId: string;
    tableId: string;
    status: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    table: {
      id: string;
      tableNumber: number;
      seatCount: number;
      status: string;
    };
    items: {
      id: string;
      menuItemId: string;
      quantity: number;
      notes: string | null;
      selectedOptions: string[];
      menuItem: {
        id: string;
        name: string;
        category: string;
        price: number;
        image: string | null;
      };
    }[];
    tickets: {
      id: string;
      ticketCode: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
  }) {
    const latestTicket = order.tickets[0] ?? null;

    return {
      id: order.id,
      tenantId: order.tenantId,
      tableId: order.tableId,
      status: order.status,
      createdBy: order.createdBy,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      table: order.table,
      items: order.items.map((item) => ({
        id: item.id,
        itemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes,
        selectedOptions: item.selectedOptions,
        item: item.menuItem,
      })),
      ticket: latestTicket,
      meta: {
        itemCount: order.items.length,
      },
    };
  }

  private formatOrderHistoryItem(order: {
    id: string;
    tenantId: string;
    tableId: string;
    status: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    table: {
      id: string;
      tableNumber: number;
      seatCount: number;
      status: string;
      served?: boolean;
    };
    items: {
      id: string;
      menuItemId: string;
      quantity: number;
      menuItem: {
        id: string;
        name: string;
        category: string;
        price: number;
        image: string | null;
      };
    }[];
    payments: {
      id: string;
      amount: number;
      method: string;
      status: string;
      createdAt: Date;
    }[];
  }) {
    return {
      id: order.id,
      tenantId: order.tenantId,
      tableId: order.tableId,
      status: order.status,
      createdBy: order.createdBy,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      table: order.table,
      items: order.items.map((item) => ({
        id: item.id,
        itemId: item.menuItemId,
        quantity: item.quantity,
        item: item.menuItem,
        lineTotal: item.quantity * item.menuItem.price,
      })),
      payments: order.payments,
      meta: {
        itemCount: order.items.length,
        totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
        totalPaidAmount: order.payments.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        ),
      },
    };
  }

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
      data: { status: 'OCCUPIED', served: false },
    });

    return this.read(tenantId, order.id);
  }

  async list(tenantId: string, dto: ListOrdersDto) {
    const where = {
      tenantId,
      status: {
        not: 'COMPLETED' as const,
      },
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        select: {
          id: true,
          tenantId: true,
          tableId: true,
          status: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          table: {
            select: {
              id: true,
              tableNumber: true,
              seatCount: true,
              status: true,
            },
          },
          items: {
            select: {
              id: true,
              menuItemId: true,
              quantity: true,
              notes: true,
              selectedOptions: true,
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  price: true,
                  image: true,
                },
              },
            },
          },
          tickets: {
            select: {
              id: true,
              ticketCode: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return buildPaginatedResponse(
      orders.map((order) => this.formatOrderListItem(order)),
      dto.page,
      dto.limit,
      total,
    );
  }

  async listHistory(tenantId: string, dto: ListOrdersDto) {
    const where = {
      tenantId,
      status: 'COMPLETED' as const,
      payments: {
        some: {
          status: 'COMPLETED' as const,
        },
      },
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        select: {
          id: true,
          tenantId: true,
          tableId: true,
          status: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          table: {
            select: {
              id: true,
              tableNumber: true,
              seatCount: true,
              status: true,
              served: true,
            },
          },
          items: {
            select: {
              id: true,
              menuItemId: true,
              quantity: true,
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  price: true,
                  image: true,
                },
              },
            },
          },
          payments: {
            where: {
              status: 'COMPLETED',
            },
            select: {
              id: true,
              amount: true,
              method: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return buildPaginatedResponse(
      orders.map((order) => this.formatOrderHistoryItem(order)),
      dto.page,
      dto.limit,
      total,
    );
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
        data: {
          status: nextTableStatus,
          ...(nextTableStatus === 'AVAILABLE' ? { served: false } : {}),
        },
      });
    }

    return order;
  }

  delete(tenantId: string, id: string) { return this.prisma.order.deleteMany({ where: { tenantId, id } }); }

  async cancel(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { tenantId, id },
      select: { id: true, tableId: true, status: true },
    });

    if (!order) {
      throw new BadRequestException('Order not found for this tenant');
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new BadRequestException('Only active orders can be cancelled');
    }

    await this.prisma.order.updateMany({
      where: { tenantId, id },
      data: { status: 'CANCELLED' },
    });

    await this.prisma.table.updateMany({
      where: { tenantId, id: order.tableId },
      data: { status: 'AVAILABLE', served: false },
    });

    return this.read(tenantId, id);
  }

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

    await this.ticketsService.createKitchenTicket(
      tenantId,
      id,
      order.items.map((item) => item.id),
    );

    await this.prisma.order.updateMany({
      where: { tenantId, id },
      data: { status: 'PREPARING' },
    });

    return this.read(tenantId, id);
  }
}
