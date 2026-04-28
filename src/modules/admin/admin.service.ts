import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  AdminSignupDto,
  AdminLoginDto,
  CreateTenantDto,
  CreateTenantRoleDto,
  ListTenantRolesDto,
  CreateTenantUserDto,
  ListTenantUsersDto,
} from './admin.dto.js';
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

  async createTenantRole(tenantId: string, dto: CreateTenantRoleDto) {
    await this.ensureTenantExists(tenantId);

    try {
      return await this.prisma.role.create({
        data: {
          name: dto.name,
          isActive: dto.isActive ?? true,
          tenantId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Role name already exists for this tenant',
        );
      }

      throw error;
    }
  }

  async listTenantRoles(tenantId: string, dto: ListTenantRolesDto) {
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

    return { data: roles, total, page: dto.page, limit: dto.limit };
  }

  async createTenantUser(tenantId: string, dto: CreateTenantUserDto) {
    await this.ensureTenantExists(tenantId);

    const [role, existingPinUser, existingEmailUser] = await Promise.all([
      this.prisma.role.findFirst({
        where: { id: dto.roleId, tenantId, isActive: true },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: { tenantId, pin: dto.pin },
        select: { id: true },
      }),
      this.prisma.user.findFirst({
        where: { email: dto.email },
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

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        pin: dto.pin,
        roleId: dto.roleId,
        tenantId,
        status: dto.status ?? 'ACTIVE',
      },
      include: {
        role: true,
      },
    });
  }

  async listTenantUsers(tenantId: string, dto: ListTenantUsersDto) {
    await this.ensureTenantExists(tenantId);

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

    return { data: users, total, page: dto.page, limit: dto.limit };
  }

  async dashboard(tenantId: string) {
    const [users, orders, tickets, payments, revenue, syncIssues] =
      await Promise.all([
        this.prisma.user.count({ where: { tenantId } }),
        this.prisma.order.count({ where: { tenantId } }),
        this.prisma.ticket.count({ where: { tenantId } }),
        this.prisma.payment.count({ where: { tenantId, status: 'COMPLETED' } }),
        this.prisma.payment.aggregate({
          where: { tenantId, status: 'COMPLETED' },
          _sum: { amount: true },
        }),
        this.prisma.device.count({ where: { tenantId, isActive: false } }),
      ]);

    return {
      counts: { users, orders, tickets, completedPayments: payments },
      revenue: revenue._sum.amount ?? 0,
      syncIssues,
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
