import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CreateTenantDto,
  ListTenantDto,
  ListTenantRolesDto,
  UpdateTenantRolesDto,
  UpdateTenantDto,
} from './tenant.dto.js';
import { RoleName } from '../../common/constants/role-name.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';

const DEFAULT_TENANT_ROLE = RoleName.MANAGER;

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTenantDto) {
    const roleCreates: Prisma.RoleCreateWithoutTenantInput[] = [
      {
        name: DEFAULT_TENANT_ROLE,
        isActive: true,
      },
    ];

    if (dto.server) {
      roleCreates.push({ name: RoleName.SERVER, isActive: true });
    }

    if (dto.kitchen) {
      roleCreates.push({ name: RoleName.KITCHEN, isActive: true });
    }

    if (dto.cashier) {
      roleCreates.push({ name: RoleName.CASHIER, isActive: true });
    }

    return this.prisma.user
      .findFirst({
        where: { email: dto.managerEmail },
        select: { id: true },
      })
      .then(async (existingManager) => {
        if (existingManager) {
          throw new BadRequestException('Manager email already exists');
        }

        const tenant = await this.prisma.tenant.create({
          data: {
            name: dto.name,
            industry: dto.industry ?? 'restaurant',
            subscriptionFee: dto.subscriptionFee ?? 0,
            status: 'ACTIVE',
            subscriptionStatus: 'PENDING',
            lastSync: new Date(),
            roles: {
              create: roleCreates,
            },
          },
          include: {
            roles: {
              orderBy: { createdAt: 'asc' },
            },
          },
        });

        const managerRole = tenant.roles.find(
          (role) => role.name === DEFAULT_TENANT_ROLE,
        );

        if (!managerRole) {
          await this.prisma.tenant.delete({ where: { id: tenant.id } });
          throw new BadRequestException('Default manager role was not created');
        }

        try {
          const manager = await this.prisma.user.create({
            data: {
              name: `${dto.name} Manager`,
              email: dto.managerEmail,
              pin: dto.managerPin,
              roleId: managerRole.id,
              tenantId: tenant.id,
              status: 'ACTIVE',
            },
            include: {
              role: true,
            },
          });

          return {
            ...tenant,
            manager,
          };
        } catch (error) {
          await this.prisma.tenant.delete({ where: { id: tenant.id } });

          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new BadRequestException('Manager email already exists');
          }

          throw error;
        }
      })
      .catch((error) => {
        if (error instanceof BadRequestException) {
          throw error;
        }

        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new BadRequestException('Manager email already exists');
        }

        throw error;
      });
  }

  async listAll(dto: ListTenantDto) {
    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count(),
    ]);

    return buildPaginatedResponse(tenants, dto.page, dto.limit, total);
  }

  async list(tenantId: string, dto: ListTenantDto) {
    const where = { id: tenantId };
    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return buildPaginatedResponse(tenants, dto.page, dto.limit, total);
  }

  read(tenantId: string, id: string) {
    if (id !== tenantId) {
      return null;
    }
    return this.prisma.tenant.findFirst({ where: { id } });
  }

  async update(tenantId: string, id: string, dto: UpdateTenantDto) {
    if (id !== tenantId) {
      return null;
    }
    await this.prisma.tenant.update({
      where: { id },
      data: {
        name: dto.name,
        industry: dto.industry,
        subscriptionFee: dto.subscriptionFee,
      },
    });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    if (id !== tenantId) {
      return { count: 0 };
    }
    return this.prisma.tenant.deleteMany({ where: { id } });
  }

  async listRoles(tenantId: string, dto: ListTenantRolesDto) {
    await this.ensureTenantExists(tenantId);

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where: { tenantId },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.role.count({ where: { tenantId } }),
    ]);

    return buildPaginatedResponse(roles, dto.page, dto.limit, total);
  }

  async updateRoles(tenantId: string, dto: UpdateTenantRolesDto) {
    await this.ensureTenantExists(tenantId);

    const roleNames: RoleName[] = [];

    if (dto.server) roleNames.push(RoleName.SERVER);
    if (dto.kitchen) roleNames.push(RoleName.KITCHEN);
    if (dto.cashier) roleNames.push(RoleName.CASHIER);

    await Promise.all(
      roleNames.map((name) =>
        this.prisma.role.upsert({
          where: { name_tenantId: { name, tenantId } },
          update: { isActive: true },
          create: {
            name,
            tenantId,
            isActive: true,
          },
        }),
      ),
    );

    return this.prisma.role.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatus(tenantId: string, status: 'ACTIVE' | 'INACTIVE') {
    await this.ensureTenantExists(tenantId);

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status },
    });
  }

  private async ensureTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
  }
}
