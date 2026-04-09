import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateDevicesDto, ListDevicesDto, UpdateDevicesDto } from './devices.dto.js';

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateDevicesDto) {
    return this.prisma.device.create({ data: { ...dto, tenantId } as any });
  }

  list(tenantId: string, dto: ListDevicesDto) {
    return this.prisma.device.findMany({
      where: { tenantId } as any,
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      orderBy: { createdAt: 'desc' } as any,
    });
  }

  read(tenantId: string, id: string) {
    return this.prisma.device.findFirst({ where: { tenantId, id } as any });
  }

  async update(tenantId: string, id: string, dto: UpdateDevicesDto) {
    await this.prisma.device.updateMany({ where: { tenantId, id } as any, data: dto as any });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.device.deleteMany({ where: { tenantId, id } as any });
  }
}
