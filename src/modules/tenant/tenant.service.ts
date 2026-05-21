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

const DEFAULT_TENANT_ROLE = RoleName.SUPERVISOR;

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  private toMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private toPercentChange(current: number, previous: number) {
    if (previous === 0) {
      return current === 0 ? 0 : 100;
    }

    return this.toMoney(((current - previous) / previous) * 100);
  }

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
        where: { email: dto.supervisorEmail },
        select: { id: true },
      })
      .then(async (existingSupervisor) => {
        if (existingSupervisor) {
          throw new BadRequestException('Supervisor email already exists');
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

        const supervisorRole = tenant.roles.find(
          (role) => role.name === DEFAULT_TENANT_ROLE,
        );

        if (!supervisorRole) {
          await this.prisma.tenant.delete({ where: { id: tenant.id } });
          throw new BadRequestException('Default supervisor role was not created');
        }

        try {
          const supervisor = await this.prisma.user.create({
            data: {
              name: `${dto.name} Supervisor`,
              email: dto.supervisorEmail,
              pin: dto.supervisorPin,
              roleId: supervisorRole.id,
              tenantId: tenant.id,
              status: 'ACTIVE',
            },
            include: {
              role: true,
            },
          });

          return {
            ...tenant,
            supervisor,
          };
        } catch (error) {
          await this.prisma.tenant.delete({ where: { id: tenant.id } });

          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new BadRequestException('Supervisor email already exists');
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
          throw new BadRequestException('Supervisor email already exists');
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

    if (dto.supervisor) roleNames.push(RoleName.SUPERVISOR);
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

  async getManagerOverview(tenantId: string) {
    await this.ensureTenantExists(tenantId);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const previousDayStart = new Date(todayStart);
    previousDayStart.setDate(previousDayStart.getDate() - 1);

    const [
      totalTransactions,
      activeDiscountCount,
      todayPayments,
      previousDayPayments,
    ] = await Promise.all([
      this.prisma.payment.count({
        where: {
          tenantId,
          status: 'COMPLETED',
        },
      }),
      this.prisma.discount.count({
        where: {
          tenantId,
          isActive: true,
        },
      }),
      this.prisma.payment.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          createdAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
        select: {
          amount: true,
        },
      }),
      this.prisma.payment.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          createdAt: {
            gte: previousDayStart,
            lt: todayStart,
          },
        },
        select: {
          amount: true,
        },
      }),
    ]);

    const todaySales = this.toMoney(
      todayPayments.reduce((sum, payment) => sum + payment.amount, 0),
    );
    const previousDaySales = this.toMoney(
      previousDayPayments.reduce((sum, payment) => sum + payment.amount, 0),
    );
    const todayTransactions = todayPayments.length;
    const previousDayTransactions = previousDayPayments.length;

    return {
      dailySales: todaySales,
      sales: {
        today: todaySales,
        previousDay: previousDaySales,
        changePercentage: this.toPercentChange(todaySales, previousDaySales),
      },
      transactions: {
        total: totalTransactions,
        today: todayTransactions,
        previousDay: previousDayTransactions,
        changePercentage: this.toPercentChange(
          todayTransactions,
          previousDayTransactions,
        ),
      },
      discounts: {
        activeCount: activeDiscountCount,
      },
      meta: {
        currency: 'USD',
        comparedAt: now,
        todayStart,
        previousDayStart,
      },
    };
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
