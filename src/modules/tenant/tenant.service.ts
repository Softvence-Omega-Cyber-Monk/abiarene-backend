import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PaymentProvidersService } from '../payments/payment-providers.service.js';
import {
  CreateTenantDto,
  InitiateSubscriptionPaymentDto,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProviders: PaymentProvidersService,
  ) {}

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

  async getSubscriptionDetails(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscriptionFee: true,
        status: true,
        subscriptionStatus: true,
        subscriptionStartAt: true,
        subscriptionEndAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const isExpired =
      !!tenant.subscriptionEndAt &&
      tenant.subscriptionEndAt.getTime() < Date.now();

    const availableProviders = [
      {
        provider: 'stripe',
        label: 'Stripe',
        configured: this.paymentProviders.isConfigured('stripe'),
      },
      {
        provider: 'orange',
        label: 'Orange Money',
        configured: this.paymentProviders.isConfigured('orange'),
      },
      {
        provider: 'mtnMomo',
        label: 'MTN MoMo',
        configured: this.paymentProviders.isConfigured('mtnMomo'),
      },
      {
        provider: 'paystack',
        label: 'Paystack',
        configured: this.paymentProviders.isConfigured('paystack'),
      },
      {
        provider: 'godaddyPayments',
        label: 'GoDaddy Payments',
        configured: this.paymentProviders.isConfigured('godaddyPayments'),
      },
    ].filter((provider) => provider.configured);

    return {
      tenant,
      subscription: {
        fee: tenant.subscriptionFee,
        status: isExpired && tenant.subscriptionStatus === 'ACTIVE'
          ? 'EXPIRED'
          : tenant.subscriptionStatus,
        startAt: tenant.subscriptionStartAt,
        endAt: tenant.subscriptionEndAt,
        requiresPayment:
          tenant.subscriptionStatus !== 'ACTIVE' || isExpired,
      },
      paymentOptions: availableProviders,
      meta: {
        paymentOptionCount: availableProviders.length,
      },
    };
  }

  async initiateSubscriptionPayment(
    tenantId: string,
    userId: string,
    dto: InitiateSubscriptionPaymentDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscriptionFee: true,
        subscriptionStatus: true,
        subscriptionStartAt: true,
        subscriptionEndAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.subscriptionFee <= 0) {
      throw new BadRequestException('This tenant does not require a subscription payment');
    }

    const isExpired =
      !!tenant.subscriptionEndAt &&
      tenant.subscriptionEndAt.getTime() < Date.now();

    if (tenant.subscriptionStatus === 'ACTIVE' && !isExpired) {
      throw new BadRequestException('Subscription is already active');
    }

    if (!this.paymentProviders.isConfigured(dto.provider)) {
      throw new BadRequestException(`Payment provider "${dto.provider}" is not configured`);
    }

    const reference = `SUB-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;

    const providerValue =
      dto.provider === 'mtnMomo'
        ? 'MTN_MOMO'
        : dto.provider === 'godaddyPayments'
          ? 'GODADDY_PAYMENTS'
          : dto.provider.toUpperCase();

    const payment = await this.prisma.subscriptionPayment.create({
      data: {
        tenantId,
        userId,
        provider: providerValue,
        amount: tenant.subscriptionFee,
        currency: 'USD',
        status: 'PENDING',
        reference,
      } as any,
      select: {
        id: true,
        tenantId: true,
        userId: true,
        provider: true,
        amount: true,
        currency: true,
        status: true,
        reference: true,
        createdAt: true,
      },
    });

    let checkout: null | Record<string, unknown> = null;
    let nextStepMessage =
      'Subscription payment was initiated. Complete the online provider flow using this payment reference.';

    if (dto.provider === 'stripe') {
      const session = await this.paymentProviders.createStripeCheckoutSession({
        amount: tenant.subscriptionFee,
        tenantName: tenant.name,
        reference,
      });

      await this.prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { externalReference: session.id },
      });

      checkout = {
        sessionId: session.id,
        url: session.url,
        paymentStatus: session.payment_status,
        status: session.status,
      };
      nextStepMessage =
        'Redirect the manager to the hosted Stripe checkout URL and then check the payment status by reference.';
    }

    return {
      payment: {
        ...payment,
        provider: dto.provider,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
      subscription: {
        fee: tenant.subscriptionFee,
        status: isExpired && tenant.subscriptionStatus === 'ACTIVE'
          ? 'EXPIRED'
          : tenant.subscriptionStatus,
      },
      checkout,
      nextStep: {
        provider: dto.provider,
        message: nextStepMessage,
      },
    };
  }

  async getSubscriptionPaymentStatus(tenantId: string, reference: string) {
    const payment = await this.prisma.subscriptionPayment.findFirst({
      where: { tenantId, reference },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        provider: true,
        amount: true,
        currency: true,
        status: true,
        reference: true,
        externalReference: true,
        completedAt: true,
        createdAt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Subscription payment not found');
    }

    if (payment.provider === 'STRIPE' && payment.externalReference) {
      const session = await this.paymentProviders.retrieveStripeCheckoutSession(
        payment.externalReference,
      );

      if (
        session.payment_status === 'paid' &&
        session.status === 'complete' &&
        payment.status !== 'COMPLETED'
      ) {
        const now = new Date();
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            subscriptionEndAt: true,
          },
        });

        const baseDate =
          tenant?.subscriptionEndAt &&
          tenant.subscriptionEndAt.getTime() > now.getTime()
            ? tenant.subscriptionEndAt
            : now;
        const nextEndAt = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

        await this.prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
          },
        });

        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: {
            subscriptionStatus: 'ACTIVE',
            subscriptionStartAt: now,
            subscriptionEndAt: nextEndAt,
          },
        });

        return this.getSubscriptionPaymentStatus(tenantId, reference);
      }

      return {
        payment: {
          ...payment,
          paymentStatus: session.payment_status,
          checkoutStatus: session.status,
        },
      };
    }

    return { payment };
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
