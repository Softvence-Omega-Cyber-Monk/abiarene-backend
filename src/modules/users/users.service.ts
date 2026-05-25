import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CreateUsersDto,
  ListUsersDto,
  UpdateMyProfileDto,
  UpdateUsersDto,
} from './users.dto.js';
import { StaffRoleName } from '../../common/constants/role-name.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createForTenant(tenantId: string, dto: CreateUsersDto) {
    await this.ensureEmailAvailable(dto.email);

    const role = await this.validateRole(tenantId, dto.role);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        image: dto.image,
        email: dto.email,
        pin: dto.pin,
        roleId: role.id,
        tenantId,
      },
    });
  }

  async listForTenant(tenantId: string, dto: ListUsersDto) {
    const where = {
      tenantId,
      name: dto.search
        ? { contains: dto.search, mode: 'insensitive' as const }
        : undefined,
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        include: { role: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResponse(users, dto.page, dto.limit, total);
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
        email: true,
        pin: true,
        roleId: true,
        role: { select: { name: true } },
      },
    });

    if (!existingUser) {
      return { count: 0 };
    }

    if (!existingUser.role?.name) {
      throw new BadRequestException('User role is not assigned');
    }

    const role = await this.validateRole(
      tenantId,
      dto.role ?? (existingUser.role.name as StaffRoleName),
    );

    await this.ensureEmailAvailable(dto.email ?? existingUser.email, id);

    await this.prisma.user.updateMany({
      where: { id, tenantId },
      data: {
        name: dto.name,
        image: dto.image,
        email: dto.email,
        pin: dto.pin,
        roleId: role.id,
        status: dto.status,
      },
    });
    return this.readForTenant(tenantId, id);
  }

  async updateMyProfile(
    tenantId: string,
    userId: string,
    dto: UpdateMyProfileDto,
  ) {
    const existingUser = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        email: true,
        pin: true,
      },
    });

    if (!existingUser) {
      return null;
    }

    await this.ensureEmailAvailable(dto.email ?? existingUser.email, userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        image: dto.image,
        email: dto.email,
        pin: dto.pin,
      },
    });

    return this.readForTenant(tenantId, userId);
  }

  readMyProfile(tenantId: string, userId: string) {
    return this.readForTenant(tenantId, userId);
  }

  deleteForTenant(tenantId: string, id: string) {
    return this.prisma.user.deleteMany({ where: { id, tenantId } });
  }

  private async validateRole(tenantId: string, roleName: StaffRoleName) {
    const role = await this.prisma.role.findFirst({
      where: { name: roleName, tenantId, isActive: true },
      select: { id: true },
    });

    if (!role) {
      throw new BadRequestException(
        'Role not found for this tenant or inactive',
      );
    }

    return role;
  }

  private async ensureEmailAvailable(email: string, userIdToExclude?: string) {
    const [existingUser, existingAdmin] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          email,
          id: userIdToExclude ? { not: userIdToExclude } : undefined,
        },
        select: { id: true },
      }),
      this.prisma.admin.findFirst({
        where: { email },
        select: { id: true },
      }),
    ]);

    if (existingUser || existingAdmin) {
      throw new BadRequestException('Email already exists');
    }
  }
}
