import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsGateway } from '../notifications/notifications.gateway.js';
import { CreateTicketsDto, ListTicketsDto, UpdateTicketsDto } from './tickets.dto.js';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsGateway) {}
  create(tenantId: string, dto: CreateTicketsDto) { return this.prisma.ticket.create({ data: { ...dto, tenantId } }); }
  list(tenantId: string, dto: ListTicketsDto) { return this.prisma.ticket.findMany({ where: { tenantId }, skip: (dto.page - 1) * dto.limit, take: dto.limit }); }
  read(tenantId: string, id: string) { return this.prisma.ticket.findFirst({ where: { tenantId, id } }); }
  async update(tenantId: string, id: string, dto: UpdateTicketsDto) { await this.prisma.ticket.updateMany({ where: { tenantId, id }, data: dto as any }); return this.read(tenantId, id); }
  delete(tenantId: string, id: string) { return this.prisma.ticket.deleteMany({ where: { tenantId, id } }); }
  async bumpToReady(tenantId: string, id: string) {
    await this.prisma.ticket.updateMany({ where: { tenantId, id }, data: { status: 'READY' } });
    this.notifications.broadcastKitchenReady({ tenantId, ticketId: id });
    return this.read(tenantId, id);
  }
}
