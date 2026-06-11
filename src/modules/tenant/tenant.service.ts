import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  createForSupervisor(userId: string, dto: CreateTenantDto) {
    const roleCreates: Prisma.RoleCreateWithoutTenantInput[] = [
      {
        name: DEFAULT_TENANT_ROLE,
        isActive: true,
      },
    ];

    if (dto.manager) {
      roleCreates.push({ name: RoleName.MANAGER, isActive: true });
    }

    if (dto.server) {
      roleCreates.push({ name: RoleName.SERVER, isActive: true });
    }

    if (dto.kitchen) {
      roleCreates.push({ name: RoleName.KITCHEN, isActive: true });
    }

    if (dto.cashier) {
      roleCreates.push({ name: RoleName.CASHIER, isActive: true });
    }

    return this.prisma.$transaction(async (tx) => {
      const supervisor = await tx.user.findFirst({
        where: { id: userId, status: 'ACTIVE' },
        include: { role: true },
      });

      if (!supervisor) {
        throw new NotFoundException('Supervisor account not found');
      }

      const resolvedRole = supervisor.role?.name ?? supervisor.pendingRole;
      if (resolvedRole !== RoleName.SUPERVISOR) {
        throw new ForbiddenException(
          'Only a supervisor account can create a tenant',
        );
      }

      if (supervisor.tenantId) {
        throw new BadRequestException(
          'This supervisor account is already assigned to a tenant',
        );
      }

      const subscriptionPrice = await tx.subscriptionPrice.findFirst({
        where: {
          id: dto.subscriptionPriceId,
          isActive: true,
        },
        select: {
          id: true,
          industry: true,
          amount: true,
          planType: true,
        },
      });

      if (!subscriptionPrice) {
        throw new BadRequestException('Subscription price not found or inactive');
      }

      if (dto.industry && dto.industry !== subscriptionPrice.industry) {
        throw new BadRequestException(
          'Selected industry does not match the selected subscription price',
        );
      }

      const now = new Date();
      const freeTrialEndAt = dto.startWithFreeTrial
        ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        : null;

      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          industry: dto.industry ?? subscriptionPrice.industry,
          mobileLogo: dto.mobileLogo,
          tabletLogo: dto.tabletLogo,
          subscriptionFee: this.toMoney(subscriptionPrice.amount),
          startsWithFreeTrial: dto.startWithFreeTrial ?? false,
          status: 'ACTIVE',
          subscriptionStatus: dto.startWithFreeTrial ? 'ACTIVE' : 'PENDING',
          subscriptionStartAt: dto.startWithFreeTrial ? now : null,
          subscriptionEndAt: freeTrialEndAt,
          lastSync: now,
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
        throw new BadRequestException('Default supervisor role was not created');
      }

      const updatedSupervisor = await tx.user.update({
        where: { id: supervisor.id },
        data: {
          roleId: supervisorRole.id,
          tenantId: tenant.id,
          pendingRole: null,
        },
        include: {
          role: true,
        },
      });

      return {
        ...tenant,
        supervisor: updatedSupervisor,
      };
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
        mobileLogo: dto.mobileLogo,
        tabletLogo: dto.tabletLogo,
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

    if (dto.manager) roleNames.push(RoleName.MANAGER);
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

  async getDailySalesHistory(tenantId: string, days = 7) {
    await this.ensureTenantExists(tenantId);

    const safeDays = Math.max(1, Math.min(days, 90));
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const rangeStart = new Date(todayStart);
    rangeStart.setDate(rangeStart.getDate() - (safeDays - 1));

    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        createdAt: {
          gte: rangeStart,
        },
      },
      select: {
        amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const history = Array.from({ length: safeDays }, (_, index) => {
      const date = new Date(rangeStart);
      date.setDate(rangeStart.getDate() + index);
      const key = date.toISOString().slice(0, 10);

      return {
        date: key,
        sales: 0,
        transactionCount: 0,
      };
    });

    const historyMap = new Map(history.map((item) => [item.date, item]));

    for (const payment of payments) {
      const key = payment.createdAt.toISOString().slice(0, 10);
      const entry = historyMap.get(key);
      if (!entry) {
        continue;
      }

      entry.sales = this.toMoney(entry.sales + payment.amount);
      entry.transactionCount += 1;
    }

    return {
      history,
      meta: {
        days: safeDays,
        currency: 'USD',
        rangeStart,
        rangeEnd: new Date(),
      },
    };
  }

  async getTotalTransactionsSummary(tenantId: string) {
    await this.ensureTenantExists(tenantId);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const previousDayStart = new Date(todayStart);
    previousDayStart.setDate(previousDayStart.getDate() - 1);

    const [total, today, previousDay] = await Promise.all([
      this.prisma.payment.count({
        where: {
          tenantId,
          status: 'COMPLETED',
        },
      }),
      this.prisma.payment.count({
        where: {
          tenantId,
          status: 'COMPLETED',
          createdAt: {
            gte: todayStart,
            lt: tomorrowStart,
          },
        },
      }),
      this.prisma.payment.count({
        where: {
          tenantId,
          status: 'COMPLETED',
          createdAt: {
            gte: previousDayStart,
            lt: todayStart,
          },
        },
      }),
    ]);

    return {
      total,
      today,
      previousDay,
      changePercentage: this.toPercentChange(today, previousDay),
      meta: {
        comparedAt: now,
        todayStart,
        previousDayStart,
      },
    };
  }

  async getActiveDiscountSummary(tenantId: string) {
    await this.ensureTenantExists(tenantId);

    const discounts = await this.prisma.discount.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        minimumPrice: true,
        offPrice: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      totalActive: discounts.length,
      discounts,
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
