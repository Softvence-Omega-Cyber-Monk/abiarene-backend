import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CreateInventoryDto,
  ListInventoryDto,
  UpdateInventoryDto,
} from './inventory.dto.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateInventoryDto) {
    return this.prisma.product.create({ data: { ...dto, tenantId } as any });
  }

  async list(tenantId: string, dto: ListInventoryDto) {
    const where = { tenantId } as any;
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' } as any,
      }),
      this.prisma.product.count({ where }),
    ]);

    return buildPaginatedResponse(products, dto.page, dto.limit, total);
  }

  read(tenantId: string, id: string) {
    return this.prisma.product.findFirst({ where: { tenantId, id } as any });
  }

  async readByInventory(tenantId: string, inventory: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        tenantId,
        OR: [{ name: inventory }, { sku: inventory }, { barcode: inventory }],
      } as any,
    });

    if (!product) {
      throw new NotFoundException('Product not found in inventory');
    }

    return product;
  }

  async update(tenantId: string, id: string, dto: UpdateInventoryDto) {
    await this.prisma.product.updateMany({
      where: { tenantId, id } as any,
      data: dto as any,
    });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.product.deleteMany({ where: { tenantId, id } as any });
  }
}
