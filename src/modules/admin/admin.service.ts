import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleName } from '../../common/constants/role-name.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AdminSignupDto,
  CreateSubscriptionPriceDto,
  CreateSubscriptionVoucherDto,
  UpdateSubscriptionPriceDto,
  UpdateSubscriptionVoucherDto,
} from './admin.dto.js';
import type { SubscriptionPlanType } from './admin.dto.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private toMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private toPercentChange(current: number, previous: number) {
    if (previous === 0) {
      return current === 0 ? 0 : 100;
    }

    return this.toMoney(((current - previous) / previous) * 100);
  }

  private getSubscriptionPlanLabel(planType: SubscriptionPlanType) {
    switch (planType) {
      case 'FREE':
        return 'Free Plan';
      case 'MONTHLY':
        return 'Monthly Plan';
      case 'YEARLY':
        return 'Yearly Plan';
    }
  }

  async signup(dto: AdminSignupDto) {
    const [existingAdmin, existingUser] = await Promise.all([
      this.prisma.admin.findUnique({
        where: { email: dto.email },
      }),
      this.prisma.user.findFirst({
        where: { email: dto.email },
        select: { id: true },
      }),
    ]);

    if (existingAdmin || existingUser) {
      throw new BadRequestException('Email already registered');
    }

    const admin = await this.prisma.admin.create({
      data: {
        email: dto.email,
        pin: dto.pin,
        name: dto.name,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        createdAt: true,
      },
    });

    const payload = { sub: admin.id, email: admin.email, role: RoleName.ADMIN };
    const authPayload = {
      ...payload,
      tokenVersion: 0,
    };

    return {
      accessToken: await this.jwtService.signAsync(authPayload),
      admin,
    };
  }

  getMyProfile(adminId: string) {
    return this.prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async dashboard() {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );

    const [
      totalTenants,
      previousMonthTotalTenants,
      activeTickets,
      currentMonthClosedIssues,
      previousMonthClosedIssues,
      currentMonthRevenue,
      previousMonthRevenue,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({
        where: {
          createdAt: {
            lt: currentMonthStart,
          },
        },
      }),
      this.prisma.supportTicket.count({
        where: {
          status: 'OPEN',
        },
      }),
      this.prisma.supportTicket.count({
        where: {
          status: 'CLOSED',
          updatedAt: {
            gte: currentMonthStart,
            lt: nextMonthStart,
          },
        },
      }),
      this.prisma.supportTicket.count({
        where: {
          status: 'CLOSED',
          updatedAt: {
            gte: previousMonthStart,
            lt: currentMonthStart,
          },
        },
      }),
      this.prisma.subscriptionPayment.aggregate({
        where: {
          status: 'COMPLETED',
          completedAt: {
            gte: currentMonthStart,
            lt: nextMonthStart,
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.subscriptionPayment.aggregate({
        where: {
          status: 'COMPLETED',
          completedAt: {
            gte: previousMonthStart,
            lt: currentMonthStart,
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const monthlyRevenue = this.toMoney(currentMonthRevenue._sum.amount ?? 0);
    const previousMonthRevenueAmount = this.toMoney(
      previousMonthRevenue._sum.amount ?? 0,
    );

    return {
      tenants: {
        total: totalTenants,
        previousMonthTotal: previousMonthTotalTenants,
        changePercentage: this.toPercentChange(
          totalTenants,
          previousMonthTotalTenants,
        ),
      },
      support: {
        activeTickets,
        closedIssues: currentMonthClosedIssues,
        previousMonthClosedIssues,
        closedIssuesChangePercentage: this.toPercentChange(
          currentMonthClosedIssues,
          previousMonthClosedIssues,
        ),
      },
      revenue: {
        monthly: monthlyRevenue,
        previousMonth: previousMonthRevenueAmount,
        changePercentage: this.toPercentChange(
          monthlyRevenue,
          previousMonthRevenueAmount,
        ),
      },
      meta: {
        comparedMonthStart: previousMonthStart,
        currentMonthStart,
        comparedAt: now,
      },
    };
  }

  createSubscriptionPrice(adminId: string, dto: CreateSubscriptionPriceDto) {
    return this.prisma.subscriptionPrice.create({
      data: {
        name: this.getSubscriptionPlanLabel(dto.planType),
        planType: dto.planType,
        industry: dto.industry ?? 'OTHER',
        description: dto.description,
        amount: this.toMoney(dto.amount),
        currency: (dto.currency ?? 'USD').toUpperCase(),
        isActive: dto.isActive ?? true,
        createdById: adminId,
      },
      select: {
        id: true,
        name: true,
        planType: true,
        industry: true,
        description: true,
        amount: true,
        currency: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }).catch((error) => {
      if (
        error?.code === 'P2002'
      ) {
        throw new BadRequestException(
          'This industry already has this subscription plan configured',
        );
      }

      throw error;
    });
  }

  listSubscriptionPrices() {
    return this.prisma.subscriptionPrice.findMany({
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        name: true,
        planType: true,
        industry: true,
        description: true,
        amount: true,
        currency: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateSubscriptionPrice(
    _adminId: string,
    id: string,
    dto: UpdateSubscriptionPriceDto,
  ) {
    const existing = await this.prisma.subscriptionPrice.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Subscription price not found');
    }

    return this.prisma.subscriptionPrice.update({
      where: { id },
      data: {
        ...(dto.planType !== undefined
          ? {
              planType: dto.planType,
              name: this.getSubscriptionPlanLabel(dto.planType),
            }
          : {}),
        ...(dto.industry !== undefined ? { industry: dto.industry } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.amount !== undefined ? { amount: this.toMoney(dto.amount) } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency.toUpperCase() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: {
        id: true,
        name: true,
        planType: true,
        industry: true,
        description: true,
        amount: true,
        currency: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }).catch((error) => {
      if (error?.code === 'P2002') {
        throw new BadRequestException(
          'This industry already has this subscription plan configured',
        );
      }

      throw error;
    });
  }

  async deleteSubscriptionPrice(id: string) {
    const existing = await this.prisma.subscriptionPrice.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Subscription price not found');
    }

    await this.prisma.subscriptionPrice.delete({
      where: { id },
    });

    return {
      success: true,
      id,
    };
  }

  async createSubscriptionVoucher(
    adminId: string,
    tenantId: string,
    dto: CreateSubscriptionVoucherDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : undefined;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid voucher expiry date');
    }

    return this.prisma.subscriptionVoucher.create({
      data: {
        tenantId,
        code: dto.code.trim().toUpperCase(),
        amountOff: this.toMoney(dto.amountOff),
        isActive: dto.isActive ?? true,
        expiresAt,
        createdById: adminId,
      },
      select: {
        id: true,
        tenantId: true,
        code: true,
        amountOff: true,
        isActive: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  listSubscriptionVouchers(tenantId: string) {
    return this.prisma.subscriptionVoucher.findMany({
      where: { tenantId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        tenantId: true,
        code: true,
        amountOff: true,
        isActive: true,
        expiresAt: true,
        usedAt: true,
        usedByUserId: true,
        usedInPaymentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateSubscriptionVoucher(
    id: string,
    dto: UpdateSubscriptionVoucherDto,
  ) {
    const existing = await this.prisma.subscriptionVoucher.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Subscription voucher not found');
    }

    const expiresAt = dto.expiresAt !== undefined
      ? dto.expiresAt
        ? new Date(dto.expiresAt)
        : null
      : undefined;

    if (
      expiresAt instanceof Date &&
      Number.isNaN(expiresAt.getTime())
    ) {
      throw new BadRequestException('Invalid voucher expiry date');
    }

    return this.prisma.subscriptionVoucher.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.amountOff !== undefined
          ? { amountOff: this.toMoney(dto.amountOff) }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(expiresAt !== undefined ? { expiresAt } : {}),
      },
      select: {
        id: true,
        tenantId: true,
        code: true,
        amountOff: true,
        isActive: true,
        expiresAt: true,
        usedAt: true,
        usedByUserId: true,
        usedInPaymentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteSubscriptionVoucher(id: string) {
    const existing = await this.prisma.subscriptionVoucher.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Subscription voucher not found');
    }

    await this.prisma.subscriptionVoucher.delete({
      where: { id },
    });

    return {
      success: true,
      id,
    };
  }
}
