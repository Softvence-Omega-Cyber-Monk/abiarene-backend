import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateUsersDto, ListUsersDto, UpdateUsersDto } from './users.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateUsersDto) {
    await this.validateRolePinAndEmail(
      tenantId,
      dto.roleId,
      dto.pin,
      dto.email,
    );

    return this.prisma.user.create({ data: { ...dto, tenantId } });
  }

  list(tenantId: string, dto: ListUsersDto) {
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

  read(tenantId: string, id: string) {
    return this.prisma.user.findFirst({
      where: { tenantId, id },
      include: { role: true },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateUsersDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: { id, tenantId },
      select: { id: true, email: true, pin: true, roleId: true },
    });

    if (!existingUser) {
      return this.prisma.user.updateMany({
        where: { id, tenantId },
        data: dto,
      });
    }

    await this.validateRolePinAndEmail(
      tenantId,
      dto.roleId ?? existingUser.roleId,
      dto.pin ?? existingUser.pin,
      dto.email ?? existingUser.email,
      id,
    );

    await this.prisma.user.updateMany({ where: { id, tenantId }, data: dto });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.user.deleteMany({ where: { id, tenantId } });
  }

  private async validateRolePinAndEmail(
    tenantId: string,
    roleId: string,
    pin: string,
    email: string,
    userIdToExclude?: string,
  ) {
    const [role, existingPinUser, existingEmailUser] = await Promise.all([
      this.prisma.role.findFirst({
        where: { id: roleId, tenantId, isActive: true },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: {
          tenantId,
          pin,
          id: userIdToExclude ? { not: userIdToExclude } : undefined,
        },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: {
          email,
          id: userIdToExclude ? { not: userIdToExclude } : undefined,
        },
        select: { id: true },
      }),
    ]);

    if (!role) {
      throw new BadRequestException(
        'Role not found for this tenant or inactive',
      );
    }

    if (existingPinUser) {
      throw new BadRequestException('PIN already exists for this tenant');
    }

    if (existingEmailUser) {
      throw new BadRequestException('Email already exists');
    }
  }
}
