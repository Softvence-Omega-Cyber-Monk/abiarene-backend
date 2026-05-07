import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';
import { ListTicketsDto } from './tickets.dto.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsGateway) {}

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
      status: dto.status,
    };

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        include: this.ticketInclude,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return buildPaginatedResponse(tickets, dto.page, dto.limit, total);
  }

  kitchenBoard(tenantId: string) {
    return this.prisma.ticket.findMany({
      where: {
        tenantId,
        status: {
          in: ['ACTIVE', 'READY'],
        },
      },
      include: this.ticketInclude,
      orderBy: [
        {
          status: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
  }

  read(tenantId: string, id: string) {
    return this.prisma.ticket.findFirst({
      where: { tenantId, id },
      include: this.ticketInclude,
    });
  }
  async bumpToReady(tenantId: string, id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { tenantId, id },
      select: { id: true, orderId: true },
    });

    if (!ticket) {
      return null;
    }

    await this.prisma.ticket.updateMany({ where: { tenantId, id }, data: { status: 'READY' } });
    await this.prisma.order.updateMany({
      where: { tenantId, id: ticket.orderId },
      data: { status: 'READY' },
    });
    this.notifications.broadcastKitchenReady({ tenantId, ticketId: id });
    return this.read(tenantId, id);
  }

  async archive(tenantId: string, id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { tenantId, id },
      select: {
        id: true,
        orderId: true,
        order: {
          select: {
            tableId: true,
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

    await this.prisma.table.updateMany({
      where: { tenantId, id: ticket.order.tableId },
      data: { status: 'AVAILABLE' },
    });

    return this.read(tenantId, id);
  }
}
