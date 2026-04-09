import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateUsersDto, ListUsersDto, UpdateUsersDto } from './users.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  create(tenantId: string, dto: CreateUsersDto) {
    return this.prisma.user.create({ data: { ...dto, tenantId } });
  }

  list(tenantId: string, dto: ListUsersDto) {
    return this.prisma.user.findMany({
      where: { tenantId, name: dto.search ? { contains: dto.search, mode: 'insensitive' } : undefined },
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  read(tenantId: string, id: string) {
    return this.prisma.user.findFirst({ where: { tenantId, id }, include: { role: true } });
  }

  update(tenantId: string, id: string, dto: UpdateUsersDto) {
    return this.prisma.user.updateMany({ where: { id, tenantId }, data: dto });
  }

  delete(tenantId: string, id: string) {
    return this.prisma.user.deleteMany({ where: { id, tenantId } });
  }
}
