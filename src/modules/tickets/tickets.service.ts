import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';
import { CreateTicketsDto, ListTicketsDto, UpdateTicketsDto } from './tickets.dto.js';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsGateway) {}

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

  create(tenantId: string, dto: CreateTicketsDto) {
    return this.prisma.ticket.create({
      data: { ...dto, tenantId },
      include: this.ticketInclude,
    });
  }

  list(tenantId: string, dto: ListTicketsDto) {
    return this.prisma.ticket.findMany({
      where: {
        tenantId,
        status: dto.status,
      },
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      include: this.ticketInclude,
      orderBy: { createdAt: 'desc' },
    });
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

  async update(tenantId: string, id: string, dto: UpdateTicketsDto) {
    await this.prisma.ticket.updateMany({ where: { tenantId, id }, data: dto as any });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) { return this.prisma.ticket.deleteMany({ where: { tenantId, id } }); }
  async bumpToReady(tenantId: string, id: string) {
    await this.prisma.ticket.updateMany({ where: { tenantId, id }, data: { status: 'READY' } });
    this.notifications.broadcastKitchenReady({ tenantId, ticketId: id });
    return this.read(tenantId, id);
  }

  async archive(tenantId: string, id: string) {
    await this.prisma.ticket.updateMany({
      where: { tenantId, id },
      data: { status: 'ARCHIVED' },
    });

    return this.read(tenantId, id);
  }
}
