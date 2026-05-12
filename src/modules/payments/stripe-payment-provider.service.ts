import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type StripeConfig = {
  secretKey: string | null;
  webhookSecret: string | null;
  defaultCurrency: string | null;
  subscriptionSuccessUrl: string | null;
  subscriptionCancelUrl: string | null;
};

@Injectable()
export class StripePaymentProviderService {
  constructor(private readonly configService: ConfigService) {}

  private getValue(key: string) {
    return this.configService.get<string>(key) ?? null;
  }

  private async callStripe<T>(path: string, init?: RequestInit) {
    const stripeConfig = this.getConfig();

    if (!stripeConfig.secretKey) {
      throw new InternalServerErrorException(
        'Stripe is not configured: missing STRIPE_SECRET_KEY',
      );
    }

    const response = await fetch(`https://api.stripe.com${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${stripeConfig.secretKey}`,
        ...(init?.headers ?? {}),
      },
    });

    const payload = (await response.json()) as T & {
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new InternalServerErrorException(
        payload.error?.message ?? 'Stripe request failed',
      );
    }

    return payload;
  }

  getConfig(): StripeConfig {
    return {
      secretKey: this.getValue('STRIPE_SECRET_KEY'),
      webhookSecret: this.getValue('STRIPE_WEBHOOK_SECRET'),
      defaultCurrency: this.getValue('STRIPE_DEFAULT_CURRENCY') ?? 'usd',
      subscriptionSuccessUrl: this.getValue('STRIPE_SUBSCRIPTION_SUCCESS_URL'),
      subscriptionCancelUrl: this.getValue('STRIPE_SUBSCRIPTION_CANCEL_URL'),
    };
  }

  async createCheckoutSession(input: {
    amount: number;
    currency?: string;
    tenantName: string;
    reference: string;
  }) {
    const stripeConfig = this.getConfig();

    const successUrl =
      stripeConfig.subscriptionSuccessUrl ??
      'http://localhost:5173/subscription/success?reference={CHECKOUT_REFERENCE}';
    const cancelUrl =
      stripeConfig.subscriptionCancelUrl ??
      'http://localhost:5173/subscription/cancel?reference={CHECKOUT_REFERENCE}';

    const body = new URLSearchParams();
    body.set('mode', 'payment');
    body.set(
      'success_url',
      successUrl.replace('{CHECKOUT_REFERENCE}', input.reference),
    );
    body.set(
      'cancel_url',
      cancelUrl.replace('{CHECKOUT_REFERENCE}', input.reference),
    );
    body.set('client_reference_id', input.reference);
    body.set('line_items[0][quantity]', '1');
    body.set(
      'line_items[0][price_data][currency]',
      (input.currency ?? stripeConfig.defaultCurrency ?? 'usd').toLowerCase(),
    );
    body.set(
      'line_items[0][price_data][unit_amount]',
      String(Math.round(input.amount * 100)),
    );
    body.set(
      'line_items[0][price_data][product_data][name]',
      `${input.tenantName} Subscription`,
    );
    body.set(
      'line_items[0][price_data][product_data][description]',
      `Subscription payment for ${input.tenantName}`,
    );

    return this.callStripe<{
      id: string;
      url: string | null;
      payment_status: string;
      status: string;
    }>('/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  }

  retrieveCheckoutSession(sessionId: string) {
    return this.callStripe<{
      id: string;
      url: string | null;
      payment_status: 'paid' | 'unpaid' | 'no_payment_required';
      status: 'open' | 'complete' | 'expired';
      client_reference_id: string | null;
    }>(`/v1/checkout/sessions/${sessionId}`, {
      method: 'GET',
    });
  }
}
