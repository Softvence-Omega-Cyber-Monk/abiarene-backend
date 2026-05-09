import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ProviderConfig = Record<string, string | null>;

@Injectable()
export class PaymentProvidersService {
  constructor(private readonly configService: ConfigService) {}

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
    return {
      secretKey: this.getValue('STRIPE_SECRET_KEY'),
      webhookSecret: this.getValue('STRIPE_WEBHOOK_SECRET'),
      defaultCurrency: this.getValue('STRIPE_DEFAULT_CURRENCY') ?? 'usd',
    };
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
    return {
      baseUrl: this.getValue('MTN_MOMO_BASE_URL'),
      subscriptionKey: this.getValue('MTN_MOMO_SUBSCRIPTION_KEY'),
      apiKey: this.getValue('MTN_MOMO_API_KEY'),
      apiSecret: this.getValue('MTN_MOMO_API_SECRET'),
      targetEnvironment: this.getValue('MTN_MOMO_TARGET_ENVIRONMENT'),
      webhookSecret: this.getValue('MTN_MOMO_WEBHOOK_SECRET'),
    };
  }

  getPaystackConfig(): ProviderConfig {
    return {
      secretKey: this.getValue('PAYSTACK_SECRET_KEY'),
      publicKey: this.getValue('PAYSTACK_PUBLIC_KEY'),
      webhookSecret: this.getValue('PAYSTACK_WEBHOOK_SECRET'),
      baseUrl:
        this.getValue('PAYSTACK_API_BASE_URL') ?? 'https://api.paystack.co',
    };
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
