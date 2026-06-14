import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { normalizeCurrencyCode } from '../payments/currency-code.utils.js';
import { ExchangeRateService } from '../payments/exchange-rate.service.js';
import { PaymentProvidersService } from '../payments/payment-providers.service.js';
import { roundAmountForCurrency } from '../payments/currency.utils.js';
import {
  InitiateSubscriptionPaymentDto,
  PAYSTACK_SUPPORTED_CURRENCIES,
} from './tenant.dto.js';

@Injectable()
export class TenantSubscriptionService {
  private readonly paystackSupportedCurrencies = new Set<string>(
    PAYSTACK_SUPPORTED_CURRENCIES,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentProviders: PaymentProvidersService,
    private readonly exchangeRates: ExchangeRateService,
    private readonly notifications: NotificationsService,
  ) {}

  private toMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private buildHostedCallbackBaseUrl(callbackBaseUrl?: string | null) {
    if (!callbackBaseUrl) {
      return null;
    }

    return callbackBaseUrl.replace(/\/+$/, '');
  }

  private normalizeVoucherCode(code?: string | null) {
    return code?.trim().toUpperCase() ?? null;
  }

  private normalizeCurrencyCode(code?: string | null) {
    return normalizeCurrencyCode(code);
  }

  private async resolvePaymentConversion(input: {
    baseAmount: number;
    baseCurrency: string;
    requestedCurrency?: string | null;
    fallbackCurrency?: string | null;
    provider: InitiateSubscriptionPaymentDto['provider'];
  }) {
    const normalizedBaseCurrency = this.normalizeCurrencyCode(input.baseCurrency);
    const normalizedRequestedCurrency = this.normalizeCurrencyCode(
      input.requestedCurrency,
    );
    const normalizedFallbackCurrency = this.normalizeCurrencyCode(
      input.fallbackCurrency,
    );

    const targetCurrency =
      input.provider === 'stripe' || input.provider === 'paystack'
        ? normalizedRequestedCurrency ??
          normalizedFallbackCurrency ??
          normalizedBaseCurrency ??
          'USD'
        : normalizedBaseCurrency ?? 'USD';

    const sourceCurrency = normalizedBaseCurrency ?? 'USD';
    const exchangeRate =
      sourceCurrency === targetCurrency
        ? 1
        : await this.exchangeRates.getRate(sourceCurrency, targetCurrency);
    const convertedAmount = roundAmountForCurrency(
      input.baseAmount * exchangeRate,
      targetCurrency,
    );

    return {
      sourceCurrency,
      targetCurrency,
      exchangeRate,
      convertedAmount,
    };
  }

  private async releaseVoucherReservation(paymentId: string, voucherId?: string | null) {
    if (!voucherId) {
      return;
    }

    await this.prisma.subscriptionVoucher.updateMany({
      where: {
        id: voucherId,
        reservedByPaymentId: paymentId,
        usedAt: null,
      },
      data: {
        reservedByPaymentId: null,
      },
    });
  }

  private async markVoucherUsed(
    paymentId: string,
    userId: string,
    voucherId?: string | null,
  ) {
    if (!voucherId) {
      return;
    }

    await this.prisma.subscriptionVoucher.updateMany({
      where: {
        id: voucherId,
        reservedByPaymentId: paymentId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
        usedByUserId: userId,
        usedInPaymentId: paymentId,
      },
    });
  }

  private async findVoucherForPayment(tenantId: string, voucherCode?: string) {
    const normalizedVoucherCode = this.normalizeVoucherCode(voucherCode);
    if (!normalizedVoucherCode) {
      return null;
    }

    const voucher = await this.prisma.subscriptionVoucher.findFirst({
      where: {
        tenantId,
        code: normalizedVoucherCode,
        isActive: true,
        usedAt: null,
      },
      select: {
        id: true,
        code: true,
        amountOff: true,
        expiresAt: true,
        reservedByPaymentId: true,
      },
    });

    if (!voucher) {
      throw new BadRequestException('Subscription voucher not found for this tenant');
    }

    if (voucher.expiresAt && voucher.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Subscription voucher has expired');
    }

    if (voucher.reservedByPaymentId) {
      const reservedPayment = await this.prisma.subscriptionPayment.findUnique({
        where: { id: voucher.reservedByPaymentId },
        select: { status: true },
      });

      if (reservedPayment?.status === 'PENDING') {
        throw new BadRequestException('Subscription voucher is already reserved for another payment');
      }
    }

    return voucher;
  }

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

  async getSubscriptionDetails(tenantId: string, displayCurrency?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        currencyCode: true,
        subscriptionFee: true,
        subscriptionCurrencyCode: true,
        startsWithFreeTrial: true,
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
        supportedCurrencies: null,
      },
      {
        provider: 'orange',
        label: 'Orange Money',
        configured: this.paymentProviders.isConfigured('orange'),
        supportedCurrencies: [],
      },
      {
        provider: 'mtnMomo',
        label: 'MTN MoMo',
        configured: this.paymentProviders.isConfigured('mtnMomo'),
        supportedCurrencies: [],
      },
      {
        provider: 'paystack',
        label: 'Paystack',
        configured: this.paymentProviders.isConfigured('paystack'),
        supportedCurrencies: PAYSTACK_SUPPORTED_CURRENCIES,
      },
      {
        provider: 'godaddyPayments',
        label: 'GoDaddy Payments',
        configured: this.paymentProviders.isConfigured('godaddyPayments'),
        supportedCurrencies: [],
      },
    ].filter((provider) => provider.configured);

    const availableVouchers = await this.prisma.subscriptionVoucher.findMany({
      where: {
        tenantId,
        isActive: true,
        usedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        code: true,
        amountOff: true,
        expiresAt: true,
      },
    });

    const feeCurrency =
      this.normalizeCurrencyCode(tenant.subscriptionCurrencyCode) ?? 'USD';
    const preferredPaymentCurrency =
      this.normalizeCurrencyCode(displayCurrency) ??
      this.normalizeCurrencyCode(tenant.currencyCode) ??
      feeCurrency;
    const feeExchangeRate =
      feeCurrency === preferredPaymentCurrency
        ? 1
        : await this.exchangeRates.getRate(feeCurrency, preferredPaymentCurrency);
    const displayFee = roundAmountForCurrency(
      tenant.subscriptionFee * feeExchangeRate,
      preferredPaymentCurrency,
    );

    return {
      tenant,
      subscription: {
        fee: displayFee,
        feeCurrency: preferredPaymentCurrency,
        originalFee: tenant.subscriptionFee,
        originalFeeCurrency: feeCurrency,
        preferredPaymentCurrency,
        exchangeRate: feeExchangeRate,
        exchangeValue: {
          amount: displayFee,
          currency: preferredPaymentCurrency,
          baseAmount: tenant.subscriptionFee,
          baseCurrency: feeCurrency,
          rate: feeExchangeRate,
        },
        status:
          isExpired && tenant.subscriptionStatus === 'ACTIVE'
            ? 'EXPIRED'
            : tenant.subscriptionStatus,
        startAt: tenant.subscriptionStartAt,
        endAt: tenant.subscriptionEndAt,
        requiresPayment:
          tenant.subscriptionStatus !== 'ACTIVE' || isExpired,
        isFreeTrial:
          tenant.startsWithFreeTrial &&
          !!tenant.subscriptionEndAt &&
          tenant.subscriptionEndAt.getTime() >= Date.now(),
      },
      paymentOptions: availableProviders,
      vouchers: availableVouchers,
      meta: {
        paymentOptionCount: availableProviders.length,
        voucherCount: availableVouchers.length,
      },
    };
  }

  listAvailableVouchers(tenantId: string) {
    return this.prisma.subscriptionVoucher.findMany({
      where: {
        tenantId,
        isActive: true,
        usedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        code: true,
        amountOff: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async initiateSubscriptionPayment(
    tenantId: string,
    userId: string,
    dto: InitiateSubscriptionPaymentDto,
    callbackBaseUrl?: string | null,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        currencyCode: true,
        subscriptionFee: true,
        subscriptionCurrencyCode: true,
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

    const voucher = await this.findVoucherForPayment(tenantId, dto.voucherCode);
    const requestedCurrency = this.normalizeCurrencyCode(dto.currency);
    const originalAmount = tenant.subscriptionFee;
    const originalCurrency =
      this.normalizeCurrencyCode(tenant.subscriptionCurrencyCode) ?? 'USD';
    const preferredPaymentCurrency =
      this.normalizeCurrencyCode(tenant.currencyCode) ?? originalCurrency;
    const discountAmount = voucher
      ? Math.min(voucher.amountOff, originalAmount)
      : 0;
    const basePayableAmount = this.toMoney(
      Math.max(0, originalAmount - discountAmount),
    );

    if (basePayableAmount > 0) {
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

      if (
        dto.provider === 'paystack' &&
        requestedCurrency &&
        !this.paystackSupportedCurrencies.has(requestedCurrency)
      ) {
        throw new BadRequestException(
          `Currency "${requestedCurrency}" is not supported for Paystack`,
        );
      }

      if (requestedCurrency && !['stripe', 'paystack'].includes(dto.provider)) {
        throw new BadRequestException(
          'Currency selection is currently supported only for Stripe and Paystack payments',
        );
      }
    }

    const conversion = await this.resolvePaymentConversion({
      baseAmount: basePayableAmount,
      baseCurrency: originalCurrency,
      requestedCurrency,
      fallbackCurrency: preferredPaymentCurrency,
      provider: dto.provider,
    });
    const paymentCurrency = conversion.targetCurrency;
    const payableAmount = conversion.convertedAmount;

    if (
      basePayableAmount > 0 &&
      dto.provider === 'paystack' &&
      !this.paystackSupportedCurrencies.has(paymentCurrency)
    ) {
      throw new BadRequestException(
        `Currency "${paymentCurrency}" is not supported for Paystack`,
      );
    }

    const reference = `SUB-${Date.now()}-${randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;
    const hostedCallbackBaseUrl =
      this.buildHostedCallbackBaseUrl(callbackBaseUrl);
    const stripeSuccessUrl = hostedCallbackBaseUrl
      ? `${hostedCallbackBaseUrl}/api/payments/callbacks/stripe/success?reference={CHECKOUT_REFERENCE}`
      : undefined;
    const stripeCancelUrl = hostedCallbackBaseUrl
      ? `${hostedCallbackBaseUrl}/api/payments/callbacks/stripe/cancel?reference={CHECKOUT_REFERENCE}`
      : undefined;
    const paystackCallbackUrl = hostedCallbackBaseUrl
      ? `${hostedCallbackBaseUrl}/api/payments/callbacks/paystack?reference={CHECKOUT_REFERENCE}`
      : undefined;

    const providerValue =
      dto.provider === 'mtnMomo'
        ? 'MTN_MOMO'
        : dto.provider === 'godaddyPayments'
          ? 'GODADDY_PAYMENTS'
          : dto.provider.toUpperCase();

    const payment = await this.prisma.$transaction(async (tx) => {
      const createdPayment = await tx.subscriptionPayment.create({
        data: {
          tenantId,
          userId,
          voucherId: voucher?.id,
          provider: providerValue,
          originalAmount,
          originalCurrency,
          discountAmount,
          exchangeRate:
            conversion.sourceCurrency === conversion.targetCurrency
              ? 1
              : conversion.exchangeRate,
          amount: payableAmount,
          currency: paymentCurrency,
          status: payableAmount === 0 ? 'COMPLETED' : 'PENDING',
          reference,
          completedAt: payableAmount === 0 ? new Date() : null,
        } as any,
        select: {
          id: true,
          tenantId: true,
          userId: true,
          voucherId: true,
          provider: true,
          originalAmount: true,
          originalCurrency: true,
          discountAmount: true,
          exchangeRate: true,
          amount: true,
          currency: true,
          status: true,
          reference: true,
          createdAt: true,
        },
      });

      if (voucher) {
        const reserved = await tx.subscriptionVoucher.updateMany({
          where: {
            id: voucher.id,
            isActive: true,
            usedAt: null,
            reservedByPaymentId: voucher.reservedByPaymentId ?? null,
          },
          data: {
            reservedByPaymentId: createdPayment.id,
          },
        });

        if (reserved.count === 0) {
          throw new BadRequestException('Subscription voucher is no longer available');
        }

        if (payableAmount === 0) {
          await tx.subscriptionVoucher.update({
            where: { id: voucher.id },
            data: {
              usedAt: new Date(),
              usedByUserId: userId,
              usedInPaymentId: createdPayment.id,
            },
          });
        }
      }

      return createdPayment;
    });

    if (payableAmount === 0) {
      await this.activateTenantSubscription(tenantId);
      const tenantName = await this.getTenantName(tenantId);
      await this.notifications.notifyTenantSubscriptionPaid({
        tenantId,
        tenantName,
        provider: 'Voucher',
        amount: payment.amount,
        currency: payment.currency,
        reference: payment.reference,
      });

      return {
        payment: {
          ...payment,
          provider: 'voucher',
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
        },
        subscription: {
          fee: tenant.subscriptionFee,
          originalAmount,
          originalCurrency,
          discountAmount,
          basePayableAmount,
          payableAmount,
          payableCurrency: paymentCurrency,
          preferredPaymentCurrency,
          exchangeRate: payment.exchangeRate ?? 1,
          status: 'ACTIVE',
        },
        voucher: voucher
          ? {
              code: voucher.code,
              amountOff: discountAmount,
            }
          : null,
        checkout: null,
        nextStep: {
          provider: 'voucher',
          message:
            'The subscription voucher fully covered the payment. Subscription was activated immediately.',
        },
      };
    }

    let checkout: null | Record<string, unknown> = null;
    let nextStepMessage =
      'Subscription payment was initiated. Complete the online provider flow using this payment reference.';

    if (dto.provider === 'stripe') {
      const session = await this.paymentProviders.createStripeCheckoutSession({
        amount: payableAmount,
        currency: paymentCurrency,
        tenantName: tenant.name,
        reference,
        successUrl: stripeSuccessUrl,
        cancelUrl: stripeCancelUrl,
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
        amount: payableAmount,
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
        amount: payableAmount,
        currency: paymentCurrency,
        email: managerUser.email,
        tenantName: tenant.name,
        reference,
        callbackUrl: paystackCallbackUrl,
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
        originalAmount,
        originalCurrency,
        discountAmount,
        basePayableAmount,
        payableAmount,
        payableCurrency: paymentCurrency,
        preferredPaymentCurrency,
        exchangeRate: payment.exchangeRate ?? 1,
        status:
          isExpired && tenant.subscriptionStatus === 'ACTIVE'
            ? 'EXPIRED'
            : tenant.subscriptionStatus,
      },
      voucher: voucher
        ? {
            code: voucher.code,
            amountOff: discountAmount,
          }
        : null,
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
        voucherId: true,
        provider: true,
        originalAmount: true,
        originalCurrency: true,
        discountAmount: true,
        exchangeRate: true,
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

        await this.markVoucherUsed(payment.id, payment.userId, payment.voucherId);
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

      if (session.status === 'expired' && payment.status === 'PENDING') {
        await this.prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' },
        });

        await this.releaseVoucherReservation(payment.id, payment.voucherId);
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

        await this.markVoucherUsed(payment.id, payment.userId, payment.voucherId);
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
        ['FAILED', 'REJECTED', 'TIMEOUT', 'EXPIRED', 'NOT_FOUND'].includes(
          requestToPay.status ?? '',
        ) &&
        payment.status === 'PENDING'
      ) {
        await this.prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: { status: 'FAILED' },
        });

        await this.releaseVoucherReservation(payment.id, payment.voucherId);
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

        await this.markVoucherUsed(payment.id, payment.userId, payment.voucherId);
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

        await this.releaseVoucherReservation(payment.id, payment.voucherId);
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
