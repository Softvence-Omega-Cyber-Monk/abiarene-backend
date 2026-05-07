import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateDiscountDto, ListDiscountDto, UpdateDiscountDto } from './discount.dto.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';

@Injectable()
export class DiscountService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, userId: string, dto: CreateDiscountDto) {
    return this.prisma.discountRequest.create({
      data: {
        tenantId,
        orderId: dto.orderId,
        requestedBy: userId,
        amount: dto.amount,
        reason: dto.reason,
      } as any,
    });
  }

  async list(tenantId: string, dto: ListDiscountDto) {
    const where = { tenantId } as any;
    const [requests, total] = await Promise.all([
      this.prisma.discountRequest.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' } as any,
      }),
      this.prisma.discountRequest.count({ where }),
    ]);

    return buildPaginatedResponse(requests, dto.page, dto.limit, total);
  }

  read(tenantId: string, id: string) {
    return this.prisma.discountRequest.findFirst({ where: { tenantId, id } as any });
  }

  async update(tenantId: string, id: string, dto: UpdateDiscountDto) {
    await this.prisma.discountRequest.updateMany({ where: { tenantId, id } as any, data: dto as any });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.discountRequest.deleteMany({ where: { tenantId, id } as any });
  }
}
