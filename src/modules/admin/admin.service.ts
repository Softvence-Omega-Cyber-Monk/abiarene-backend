import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AdminSignupDto } from './admin.dto.js';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

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

    const payload = { sub: admin.id, email: admin.email, role: 'admin' };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      admin,
    };
  }

  async dashboard() {
    const [tenants, users, orders, tickets, payments, revenue] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.user.count(),
      this.prisma.order.count(),
      this.prisma.ticket.count(),
      this.prisma.payment.count({ where: { status: 'COMPLETED' } }),
      this.prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true },
      }),
    ]);

    return {
      counts: { tenants, users, orders, tickets, completedPayments: payments },
      revenue: revenue._sum.amount ?? 0,
    };
  }
}
