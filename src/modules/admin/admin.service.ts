import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const [users, orders, tickets, payments, revenue, syncIssues] = await Promise.all([
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.order.count({ where: { tenantId } }),
      this.prisma.ticket.count({ where: { tenantId } }),
      this.prisma.payment.count({ where: { tenantId, status: 'COMPLETED' } }),
      this.prisma.payment.aggregate({ where: { tenantId, status: 'COMPLETED' }, _sum: { amount: true } }),
      this.prisma.device.count({ where: { tenantId, isActive: false } }),
    ]);

    return {
      counts: { users, orders, tickets, completedPayments: payments },
      revenue: revenue._sum.amount ?? 0,
      syncIssues,
    };
  }
}
