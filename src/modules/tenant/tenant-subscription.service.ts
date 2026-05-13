import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PaymentProvidersService } from '../payments/payment-providers.service.js';
import { InitiateSubscriptionPaymentDto } from './tenant.dto.js';

@Injectable()
export class TenantSubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProviders: PaymentProvidersService,
    private readonly notifications: NotificationsService,
  ) {}

  private async activateTenantSubscription(tenantId: string) {
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

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionStartAt: now,
        subscriptionEndAt: nextEndAt,
      },
    });
  }

  private async getTenantName(tenantId: string) {
    return (
      (
        await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        })
      )?.name ?? 'Unknown Tenant'
    );
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
        status:
          isExpired && tenant.subscriptionStatus === 'ACTIVE'
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
        users: {
          where: { id: userId },
          select: {
            id: true,
            email: true,
          },
          take: 1,
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.subscriptionFee <= 0) {
      throw new BadRequestException(
        'This tenant does not require a subscription payment',
      );
    }

    const isExpired =
      !!tenant.subscriptionEndAt &&
      tenant.subscriptionEndAt.getTime() < Date.now();

    if (tenant.subscriptionStatus === 'ACTIVE' && !isExpired) {
      throw new BadRequestException('Subscription is already active');
    }

    const managerUser = tenant.users[0];

    if (!managerUser?.email) {
      throw new BadRequestException(
        'Manager email is required for subscription payment',
      );
    }

    if (!this.paymentProviders.isConfigured(dto.provider)) {
      throw new BadRequestException(
        `Payment provider "${dto.provider}" is not configured`,
      );
    }

    if (dto.provider === 'mtnMomo' && !dto.payerPhoneNumber) {
      throw new BadRequestException(
        'payerPhoneNumber is required for MTN MoMo payments',
      );
    }

    const reference = `SUB-${Date.now()}-${randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;

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
    } else if (dto.provider === 'mtnMomo') {
      const requestToPay = await this.paymentProviders.createMtnMomoRequestToPay({
        amount: tenant.subscriptionFee,
        phoneNumber: dto.payerPhoneNumber!,
        tenantName: tenant.name,
        reference,
      });

      await this.prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          externalReference: requestToPay.referenceId,
        },
      });

      checkout = {
        requestToPayReferenceId: requestToPay.referenceId,
        payerPhoneNumber: dto.payerPhoneNumber,
        requestStatusCode: requestToPay.status,
      };
      nextStepMessage =
        'Ask the manager to approve the MTN MoMo request on the mobile device, then check the payment status by reference.';
    } else if (dto.provider === 'paystack') {
      const transaction = await this.paymentProviders.createPaystackTransaction({
        amount: tenant.subscriptionFee,
        email: managerUser.email,
        tenantName: tenant.name,
        reference,
      });

      await this.prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          externalReference: transaction.data.access_code,
        },
      });

      checkout = {
        authorizationUrl: transaction.data.authorization_url,
        accessCode: transaction.data.access_code,
        reference: transaction.data.reference,
      };
      nextStepMessage =
        'Redirect the manager to the Paystack authorization URL and then check the payment status by reference.';
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
        status:
          isExpired && tenant.subscriptionStatus === 'ACTIVE'
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

        await this.prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
          },
        });

        await this.activateTenantSubscription(tenantId);
        const tenantName = await this.getTenantName(tenantId);
        await this.notifications.notifyTenantSubscriptionPaid({
          tenantId,
          tenantName,
          provider: 'Stripe',
          amount: payment.amount,
          currency: payment.currency,
          reference: payment.reference,
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

    if (payment.provider === 'MTN_MOMO' && payment.externalReference) {
      const requestToPay = await this.paymentProviders.getMtnMomoRequestToPayStatus(
        payment.externalReference,
      );

      if (requestToPay.status === 'SUCCESSFUL' && payment.status !== 'COMPLETED') {
        await this.prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });

        await this.activateTenantSubscription(tenantId);
        const tenantName = await this.getTenantName(tenantId);
        await this.notifications.notifyTenantSubscriptionPaid({
          tenantId,
          tenantName,
          provider: 'MTN MoMo',
          amount: payment.amount,
          currency: payment.currency,
          reference: payment.reference,
        });

        return this.getSubscriptionPaymentStatus(tenantId, reference);
      }

      if (
        ['FAILED', 'REJECTED', 'TIMEOUT'].includes(requestToPay.status ?? '') &&
        payment.status === 'PENDING'
      ) {
        await this.prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' },
        });

        return this.getSubscriptionPaymentStatus(tenantId, reference);
      }

      return {
        payment: {
          ...payment,
          paymentStatus: requestToPay.status ?? 'PENDING',
          financialTransactionId: requestToPay.financialTransactionId ?? null,
          payer: requestToPay.payer ?? null,
          providerReason: requestToPay.reason ?? null,
        },
      };
    }

    if (payment.provider === 'PAYSTACK') {
      const transaction = await this.paymentProviders.verifyPaystackTransaction(
        reference,
      );

      if (transaction.data.status === 'success' && payment.status !== 'COMPLETED') {
        const paidAt = transaction.data.paid_at
          ? new Date(transaction.data.paid_at)
          : new Date();

        await this.prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: 'COMPLETED',
            completedAt: paidAt,
          },
        });

        await this.activateTenantSubscription(tenantId);
        const tenantName = await this.getTenantName(tenantId);
        await this.notifications.notifyTenantSubscriptionPaid({
          tenantId,
          tenantName,
          provider: 'Paystack',
          amount: payment.amount,
          currency: payment.currency,
          reference: payment.reference,
        });

        return this.getSubscriptionPaymentStatus(tenantId, reference);
      }

      if (
        ['failed', 'abandoned', 'reversed'].includes(transaction.data.status) &&
        payment.status === 'PENDING'
      ) {
        await this.prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' },
        });

        return this.getSubscriptionPaymentStatus(tenantId, reference);
      }

      return {
        payment: {
          ...payment,
          paymentStatus: transaction.data.status,
          gatewayResponse: transaction.data.gateway_response ?? null,
        },
      };
    }

    return { payment };
  }
}
