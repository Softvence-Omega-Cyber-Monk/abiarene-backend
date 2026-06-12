import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreatePaymentsDto, ListPaymentsDto, UpdatePaymentsDto } from './payments.dto.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreatePaymentsDto) {
    return this.prisma.payment.create({
      data: { ...dto, tenantId, method: (dto.method as any) ?? 'CASH' } as any,
    });
  }

  async list(tenantId: string, dto: ListPaymentsDto) {
    const where = { tenantId };
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return buildPaginatedResponse(payments, dto.page, dto.limit, total);
  }

  read(tenantId: string, id: string) {
    return this.prisma.payment.findFirst({ where: { tenantId, id } });
  }

  async update(tenantId: string, id: string, dto: UpdatePaymentsDto) {
    await this.prisma.payment.updateMany({ where: { tenantId, id }, data: dto as any });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.payment.deleteMany({ where: { tenantId, id } });
  }
}
