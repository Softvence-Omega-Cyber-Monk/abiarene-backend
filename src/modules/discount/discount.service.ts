import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateDiscountDto, ListDiscountDto, UpdateDiscountDto } from './discount.dto.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';

@Injectable()
export class DiscountService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateDiscountDto) {
    return this.prisma.discount.create({
      data: {
        tenantId,
        name: dto.name,
        minimumPrice: dto.minimumPrice,
        offPrice: dto.offPrice,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async list(tenantId: string, dto: ListDiscountDto) {
    const where = {
      tenantId,
      isActive: dto.isActive,
    };

    const [discounts, total] = await Promise.all([
      this.prisma.discount.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.discount.count({ where }),
    ]);

    return buildPaginatedResponse(discounts, dto.page, dto.limit, total);
  }

  read(tenantId: string, id: string) {
    return this.prisma.discount.findFirst({
      where: { tenantId, id },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateDiscountDto) {
    await this.prisma.discount.updateMany({
      where: { tenantId, id },
      data: dto,
    });

    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.discount.deleteMany({
      where: { tenantId, id },
    });
  }
}
