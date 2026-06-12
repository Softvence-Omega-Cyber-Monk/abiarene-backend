import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ListTicketsDto } from './tickets.dto.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private mapTicketStatus(status: 'ACTIVE' | 'READY' | 'ARCHIVED') {
    switch (status) {
      case 'ACTIVE':
        return 'PREPARING' as const;
      case 'READY':
        return 'READY' as const;
      case 'ARCHIVED':
        return 'COMPLETED' as const;
    }
  }

  private unmapTicketStatus(status?: 'PREPARING' | 'READY' | 'COMPLETED') {
    switch (status) {
      case 'PREPARING':
        return 'ACTIVE' as const;
      case 'READY':
        return 'READY' as const;
      case 'COMPLETED':
        return 'ARCHIVED' as const;
      default:
        return undefined;
    }
  }

  private formatTicketDetail(ticket: any) {
    if (!ticket) {
      return null;
    }

    return {
      ...ticket,
      status: this.mapTicketStatus(ticket.status),
    };
  }

  private resolveTicketItem(orderItem: any) {
    const source = orderItem.menuItem ?? orderItem.product ?? null;
    const itemId =
      orderItem.menuItemId ?? orderItem.productId ?? source?.id ?? orderItem.id;
    const name = orderItem.itemName ?? source?.name ?? 'Unknown Item';
    const category = orderItem.itemCategory ?? source?.category ?? null;
    const image = orderItem.itemImage ?? source?.image ?? null;
    const unitPrice = orderItem.unitPrice ?? source?.price ?? 0;

    return {
      id: orderItem.id,
      quantity: orderItem.quantity,
      notes: orderItem.notes,
      selectedOptions: orderItem.selectedOptions,
      item: {
        id: itemId,
        name,
        category,
        image,
        price: unitPrice,
      },
      sourceType: orderItem.productId ? 'INVENTORY' : 'MENU',
    };
  }

  private formatTicketSummary(ticket: {
    id: string;
    ticketCode: string;
    tenantId: string;
    orderId: string;
    status: 'ACTIVE' | 'READY' | 'ARCHIVED';
    createdAt: Date;
    updatedAt: Date;
    order: {
      id: string;
      orderType: string;
      status: string;
      createdAt: Date;
      table: {
        id: string;
        tableNumber: number;
        seatCount: number;
        status: string;
        served: boolean;
      } | null;
    };
    items: {
      id: string;
      orderItem: {
        id: string;
        menuItemId: string | null;
        productId: string | null;
        itemName: string | null;
        itemCategory: string | null;
        itemImage: string | null;
        unitPrice: number | null;
        quantity: number;
        notes: string | null;
        selectedOptions: string[];
        menuItem: {
          id: string;
          name: string;
          category: string;
          image: string | null;
          price: number;
        } | null;
        product: {
          id: string;
          name: string;
          price: number;
        } | null;
      };
    }[];
  }) {
    return {
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      tenantId: ticket.tenantId,
      orderId: ticket.orderId,
      status: this.mapTicketStatus(ticket.status),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      order: {
        id: ticket.order.id,
        orderType: ticket.order.orderType,
        status: ticket.order.status,
        createdAt: ticket.order.createdAt,
      },
      table: ticket.order.table,
      items: ticket.items.map((item) => this.resolveTicketItem(item.orderItem)),
      meta: {
        itemCount: ticket.items.length,
        totalQuantity: ticket.items.reduce(
          (sum, item) => sum + item.orderItem.quantity,
          0,
        ),
      },
    };
  }

  private readonly ticketSummarySelect = {
    id: true,
    ticketCode: true,
    tenantId: true,
    orderId: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    order: {
      select: {
        id: true,
        status: true,
        orderType: true,
        createdAt: true,
        table: {
          select: {
            id: true,
            tableNumber: true,
            seatCount: true,
            status: true,
            served: true,
          },
        },
      },
    },
    items: {
      select: {
        id: true,
        orderItem: {
          select: {
            id: true,
            menuItemId: true,
            productId: true,
            itemName: true,
            itemCategory: true,
            itemImage: true,
            unitPrice: true,
            quantity: true,
            notes: true,
            selectedOptions: true,
            menuItem: {
              select: {
                id: true,
                name: true,
                category: true,
                image: true,
                price: true,
              },
            },
            product: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
      orderBy: {
        id: 'asc' as const,
      },
    },
  };

  private async generateTicketCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const ticketCode = randomBytes(4).toString('hex');
      const existing = await this.prisma.ticket.findUnique({
        where: { ticketCode },
        select: { id: true },
      });

      if (!existing) {
        return ticketCode;
      }
    }

    throw new Error('Unable to generate a unique ticket code');
  }

  private readonly ticketInclude = {
    order: {
      include: {
        table: true,
      },
    },
    items: {
      include: {
        orderItem: {
          include: {
            menuItem: true,
            product: true,
          },
        },
      },
      orderBy: {
        id: 'asc' as const,
      },
    },
  };

  async createKitchenTicket(
    tenantId: string,
    orderId: string,
    orderItemIds: string[],
    status?: 'ACTIVE' | 'READY' | 'ARCHIVED',
  ) {
    const ticketCode = await this.generateTicketCode();

    return this.prisma.ticket.create({
      data: {
        orderId,
        tenantId,
        status,
        ticketCode,
        items: orderItemIds.length
          ? {
              create: orderItemIds.map((orderItemId) => ({
                orderItemId,
              })),
            }
          : undefined,
      },
      include: this.ticketInclude,
    });
  }

  async list(tenantId: string, dto: ListTicketsDto) {
    const where = {
      tenantId,
      status: this.unmapTicketStatus(dto.status),
    };

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        select: this.ticketSummarySelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return buildPaginatedResponse(
      tickets.map((ticket) => this.formatTicketSummary(ticket as any)),
      dto.page,
      dto.limit,
      total,
    );
  }

  async kitchenBoard(tenantId: string) {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        tenantId,
        status: {
          in: ['ACTIVE', 'READY'],
        },
      },
      select: this.ticketSummarySelect,
      orderBy: [
        {
          status: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    return tickets.map((ticket) => this.formatTicketSummary(ticket as any));
  }

  read(tenantId: string, id: string) {
    return this.prisma.ticket.findFirst({
      where: { tenantId, id },
      include: this.ticketInclude,
    }).then((ticket) => this.formatTicketDetail(ticket));
  }
  async bumpToReady(tenantId: string, id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { tenantId, id },
      select: {
        id: true,
        ticketCode: true,
        orderId: true,
        order: {
          select: {
            orderType: true,
            tableId: true,
            table: {
              select: {
                tableNumber: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      return null;
    }

    await this.prisma.ticket.updateMany({ where: { tenantId, id }, data: { status: 'READY' } });
    await this.prisma.order.updateMany({
      where: { tenantId, id: ticket.orderId },
      data: { status: 'READY' },
    });

    await this.notifications.notifyKitchenOrderReady({
      tenantId,
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      orderId: ticket.orderId,
      tableId: ticket.order.tableId,
      tableNumber: ticket.order.table?.tableNumber,
      orderType: ticket.order.orderType as 'DINE_IN' | 'DIRECT',
    });

    return this.read(tenantId, id);
  }

  async archive(tenantId: string, id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { tenantId, id },
      select: {
        id: true,
        ticketCode: true,
        orderId: true,
        order: {
          select: {
            orderType: true,
            tableId: true,
            table: {
              select: {
                tableNumber: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      return null;
    }

    await this.prisma.ticket.updateMany({
      where: { tenantId, id },
      data: { status: 'ARCHIVED' },
    });

    await this.prisma.order.updateMany({
      where: { tenantId, id: ticket.orderId },
      data: { status: 'COMPLETED' },
    });

    await this.notifications.notifyOrderArchived({
      tenantId,
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      orderId: ticket.orderId,
      tableId: ticket.order.tableId,
      tableNumber: ticket.order.table?.tableNumber,
      orderType: ticket.order.orderType as 'DINE_IN' | 'DIRECT',
    });

    return this.read(tenantId, id);
  }
}
