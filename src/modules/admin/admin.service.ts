import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleName } from '../../common/constants/role-name.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AdminSignupDto } from './admin.dto.js';

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
}
