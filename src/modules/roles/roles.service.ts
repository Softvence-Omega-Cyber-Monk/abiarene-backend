import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateRolesDto, ListRolesDto, UpdateRolesDto } from './roles.dto.js';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateRolesDto) {
    return this.prisma.role.create({ data: { ...dto, tenantId } });
  }

  list(tenantId: string, dto: ListRolesDto) {
    return this.prisma.role.findMany({
      where: { tenantId },
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  read(tenantId: string, id: string) {
    return this.prisma.role.findFirst({ where: { tenantId, id } });
  }

  async update(tenantId: string, id: string, dto: UpdateRolesDto) {
    await this.prisma.role.updateMany({ where: { tenantId, id }, data: dto });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.role.deleteMany({ where: { tenantId, id } });
  }
}
