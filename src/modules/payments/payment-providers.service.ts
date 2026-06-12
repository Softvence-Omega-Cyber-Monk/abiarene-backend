import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MtnMomoPaymentProviderService } from './mtn-momo-payment-provider.service.js';
import { PaystackPaymentProviderService } from './paystack-payment-provider.service.js';
import { StripePaymentProviderService } from './stripe-payment-provider.service.js';

type ProviderConfig = Record<string, string | null>;

@Injectable()
export class PaymentProvidersService {
  constructor(
    private readonly configService: ConfigService,
    private readonly stripeProvider: StripePaymentProviderService,
    private readonly mtnMomoProvider: MtnMomoPaymentProviderService,
    private readonly paystackProvider: PaystackPaymentProviderService,
  ) {}

  private getValue(key: string) {
    return this.configService.get<string>(key) ?? null;
  }

  private requireValue(provider: string, key: string) {
    const value = this.getValue(key);
    if (!value) {
      throw new InternalServerErrorException(
        `${provider} is not configured: missing ${key}`,
      );
    }
    return value;
  }

  getStripeConfig(): ProviderConfig {
    return this.stripeProvider.getConfig();
  }

  createStripeCheckoutSession(input: {
    amount: number;
    currency?: string;
    tenantName: string;
    reference: string;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    return this.stripeProvider.createCheckoutSession(input);
  }

  retrieveStripeCheckoutSession(sessionId: string) {
    return this.stripeProvider.retrieveCheckoutSession(sessionId);
  }

  getOrangeConfig(): ProviderConfig {
    return {
      baseUrl: this.getValue('ORANGE_API_BASE_URL'),
      clientId: this.getValue('ORANGE_CLIENT_ID'),
      clientSecret: this.getValue('ORANGE_CLIENT_SECRET'),
      merchantKey: this.getValue('ORANGE_MERCHANT_KEY'),
      webhookSecret: this.getValue('ORANGE_WEBHOOK_SECRET'),
    };
  }

  getMtnMomoConfig(): ProviderConfig {
    return this.mtnMomoProvider.getConfig();
  }

  createMtnMomoRequestToPay(input: {
    amount: number;
    currency?: string;
    phoneNumber: string;
    tenantName: string;
    reference: string;
  }) {
    return this.mtnMomoProvider.createRequestToPay(input);
  }

  getMtnMomoRequestToPayStatus(referenceId: string) {
    return this.mtnMomoProvider.getRequestToPayStatus(referenceId);
  }

  getPaystackConfig(): ProviderConfig {
    return this.paystackProvider.getConfig();
  }

  createPaystackTransaction(input: {
    amount: number;
    currency?: string;
    email: string;
    tenantName: string;
    reference: string;
    callbackUrl?: string;
  }) {
    return this.paystackProvider.createTransaction(input);
  }

  verifyPaystackTransaction(reference: string) {
    return this.paystackProvider.verifyTransaction(reference);
  }

  getGoDaddyPaymentsConfig(): ProviderConfig {
    return {
      baseUrl: this.getValue('GODADDY_PAYMENTS_API_BASE_URL'),
      merchantId: this.getValue('GODADDY_PAYMENTS_MERCHANT_ID'),
      apiKey: this.getValue('GODADDY_PAYMENTS_API_KEY'),
      apiSecret: this.getValue('GODADDY_PAYMENTS_API_SECRET'),
      webhookSecret: this.getValue('GODADDY_PAYMENTS_WEBHOOK_SECRET'),
    };
  }

  isConfigured(
    provider: 'stripe' | 'orange' | 'mtnMomo' | 'paystack' | 'godaddyPayments',
  ) {
    switch (provider) {
      case 'stripe':
        return !!this.getStripeConfig().secretKey;
      case 'orange':
        return (
          !!this.getOrangeConfig().clientId &&
          !!this.getOrangeConfig().clientSecret
        );
      case 'mtnMomo':
        return (
          !!this.getMtnMomoConfig().subscriptionKey &&
          !!this.getMtnMomoConfig().apiKey
        );
      case 'paystack':
        return !!this.getPaystackConfig().secretKey;
      case 'godaddyPayments':
        return (
          !!this.getGoDaddyPaymentsConfig().merchantId &&
          !!this.getGoDaddyPaymentsConfig().apiKey
        );
    }
  }

  assertConfigured(
    provider: 'stripe' | 'orange' | 'mtnMomo' | 'paystack' | 'godaddyPayments',
  ) {
    switch (provider) {
      case 'stripe':
        return this.requireValue('Stripe', 'STRIPE_SECRET_KEY');
      case 'orange':
        this.requireValue('Orange', 'ORANGE_CLIENT_ID');
        return this.requireValue('Orange', 'ORANGE_CLIENT_SECRET');
      case 'mtnMomo':
        this.requireValue('MTN MoMo', 'MTN_MOMO_SUBSCRIPTION_KEY');
        return this.requireValue('MTN MoMo', 'MTN_MOMO_API_KEY');
      case 'paystack':
        return this.requireValue('Paystack', 'PAYSTACK_SECRET_KEY');
      case 'godaddyPayments':
        this.requireValue('GoDaddy Payments', 'GODADDY_PAYMENTS_MERCHANT_ID');
        return this.requireValue(
          'GoDaddy Payments',
          'GODADDY_PAYMENTS_API_KEY',
        );
    }
  }
}
