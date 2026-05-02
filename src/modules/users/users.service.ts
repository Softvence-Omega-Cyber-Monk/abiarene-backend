import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateUsersDto, ListUsersDto, UpdateUsersDto } from './users.dto.js';
import { StaffRoleName } from '../../common/constants/role-name.js';
import { randomUUID } from 'crypto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createForTenant(tenantId: string, dto: CreateUsersDto) {
    const role = await this.validateRoleAndPin(
      tenantId,
      dto.role,
      dto.pin,
    );

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: this.generateInternalEmail(tenantId),
        pin: dto.pin,
        roleId: role.id,
        tenantId,
      },
    });
  }

  listForTenant(tenantId: string, dto: ListUsersDto) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        name: dto.search
          ? { contains: dto.search, mode: 'insensitive' }
          : undefined,
      },
      skip: (dto.page - 1) * dto.limit,
      take: dto.limit,
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  readForTenant(tenantId: string, id: string) {
    return this.prisma.user.findFirst({
      where: { tenantId, id },
      include: { role: true },
    });
  }

  async updateForTenant(tenantId: string, id: string, dto: UpdateUsersDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        pin: true,
        roleId: true,
        role: { select: { name: true } },
      },
    });

    if (!existingUser) {
      return { count: 0 };
    }

    const role = await this.validateRoleAndPin(
      tenantId,
      dto.role ?? (existingUser.role.name as StaffRoleName),
      dto.pin ?? existingUser.pin,
      id,
    );

    await this.prisma.user.updateMany({
      where: { id, tenantId },
      data: {
        name: dto.name,
        pin: dto.pin,
        roleId: role.id,
        status: dto.status,
      },
    });
    return this.readForTenant(tenantId, id);
  }

  deleteForTenant(tenantId: string, id: string) {
    return this.prisma.user.deleteMany({ where: { id, tenantId } });
  }

  private async validateRoleAndPin(
    tenantId: string,
    roleName: StaffRoleName,
    pin: string,
    userIdToExclude?: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: { name: roleName, tenantId, isActive: true },
      select: { id: true },
    });

    if (!role) {
      throw new BadRequestException(
        'Role not found for this tenant or inactive',
      );
    }

    const existingPinUser = await this.prisma.user.findFirst({
      where: {
        roleId: role.id,
        pin,
        id: userIdToExclude ? { not: userIdToExclude } : undefined,
      },
      select: { id: true },
    });

    if (existingPinUser) {
      throw new BadRequestException('PIN already exists for this role');
    }

    return role;
  }

  private generateInternalEmail(tenantId: string) {
    return `user-${tenantId}-${randomUUID()}@tenant.local`;
  }
}
