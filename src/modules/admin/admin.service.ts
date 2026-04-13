import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AdminSignupDto, AdminLoginDto, CreateTenantDto } from './admin.dto.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(dto: AdminSignupDto) {
    const existingAdmin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    if (existingAdmin) {
      throw new BadRequestException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const admin = await this.prisma.admin.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        status: 'ACTIVE',
      },
      select: { id: true, email: true, name: true, status: true, createdAt: true },
    });

    const payload = { sub: admin.id, email: admin.email, role: 'admin' };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      admin,
    };
  }

  async login(dto: AdminLoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = { sub: admin.id, email: admin.email, role: 'admin' };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        status: admin.status,
        createdAt: admin.createdAt,
      },
    };
  }

  async createTenant(dto: CreateTenantDto) {
    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        industry: dto.industry ?? 'restaurant',
        subscriptionFee: dto.subscriptionFee ?? 0,
        status: 'ACTIVE',
        lastSync: new Date(),
      },
    });
  }

  async listTenants(page: number = 1, limit: number = 10) {
    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count(),
    ]);

    return { data: tenants, total, page, limit };
  }

  async dashboard(tenantId: string) {
    const [users, orders, tickets, payments, revenue, syncIssues] = await Promise.all([
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.order.count({ where: { tenantId } }),
      this.prisma.ticket.count({ where: { tenantId } }),
      this.prisma.payment.count({ where: { tenantId, status: 'COMPLETED' } }),
      this.prisma.payment.aggregate({ where: { tenantId, status: 'COMPLETED' }, _sum: { amount: true } }),
      this.prisma.device.count({ where: { tenantId, isActive: false } }),
    ]);

    return {
      counts: { users, orders, tickets, completedPayments: payments },
      revenue: revenue._sum.amount ?? 0,
      syncIssues,
    };
  }
}
