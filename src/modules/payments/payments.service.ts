import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreatePaymentsDto, ListPaymentsDto, UpdatePaymentsDto } from './payments.dto.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}
  create(tenantId: string, dto: CreatePaymentsDto) { return this.prisma.payment.create({ data: { ...dto, tenantId, method: (dto.method as any) ?? 'CASH' } }); }
  list(tenantId: string, dto: ListPaymentsDto) { return this.prisma.payment.findMany({ where: { tenantId }, skip: (dto.page - 1) * dto.limit, take: dto.limit }); }
  read(tenantId: string, id: string) { return this.prisma.payment.findFirst({ where: { tenantId, id } }); }
  async update(tenantId: string, id: string, dto: UpdatePaymentsDto) { await this.prisma.payment.updateMany({ where: { tenantId, id }, data: dto as any }); return this.read(tenantId, id); }
  delete(tenantId: string, id: string) { return this.prisma.payment.deleteMany({ where: { tenantId, id } }); }
  async completePayment(tenantId: string, id: string) {
    await this.prisma.payment.updateMany({ where: { tenantId, id }, data: { status: 'COMPLETED' } });
    return this.read(tenantId, id);
  }
}
