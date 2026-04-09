import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AddOrderItemsDto, CreateOrdersDto, ListOrdersDto, UpdateOrdersDto } from './orders.dto.js';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, userId: string, dto: CreateOrdersDto) {
    return this.prisma.order.create({ data: { ...dto, tenantId, createdBy: userId } });
  }

  list(tenantId: string, dto: ListOrdersDto) {
    return this.prisma.order.findMany({ where: { tenantId }, skip: (dto.page - 1) * dto.limit, take: dto.limit, include: { items: true } });
  }

  read(tenantId: string, id: string) { return this.prisma.order.findFirst({ where: { tenantId, id }, include: { items: true } }); }

  async update(tenantId: string, id: string, dto: UpdateOrdersDto) {
    await this.prisma.order.updateMany({ where: { tenantId, id }, data: dto as any });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) { return this.prisma.order.deleteMany({ where: { tenantId, id } }); }

  addItems(_tenantId: string, id: string, dto: AddOrderItemsDto) {
    return this.prisma.orderItem.createMany({
      data: dto.items.map((item) => ({ orderId: id, menuItemId: item.menuItemId, quantity: item.quantity, notes: item.notes })),
    });
  }

  async sendToKitchen(tenantId: string, id: string) {
    await this.prisma.order.updateMany({ where: { tenantId, id }, data: { status: 'IN_KITCHEN' } });
    return this.read(tenantId, id);
  }
}
