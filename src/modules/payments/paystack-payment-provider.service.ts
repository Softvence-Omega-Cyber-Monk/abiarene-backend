import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type PaystackConfig = {
  secretKey: string | null;
  publicKey: string | null;
  webhookSecret: string | null;
  defaultCurrency: string | null;
  subscriptionCallbackUrl: string | null;
  baseUrl: string | null;
};

@Injectable()
export class PaystackPaymentProviderService {
  constructor(private readonly configService: ConfigService) {}

  private getValue(key: string) {
    return this.configService.get<string>(key) ?? null;
  }

  private async callPaystack<T>(path: string, init?: RequestInit) {
    const paystackConfig = this.getConfig();

    if (!paystackConfig.secretKey) {
      throw new InternalServerErrorException(
        'Paystack is not configured: missing PAYSTACK_SECRET_KEY',
      );
    }

    const baseUrl = paystackConfig.baseUrl ?? 'https://api.paystack.co';
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${paystackConfig.secretKey}`,
        ...(init?.headers ?? {}),
      },
    });

    const payload = (await response.json()) as T & {
      message?: string;
      data?: unknown;
    };

    if (!response.ok) {
      throw new InternalServerErrorException(
        payload.message ?? 'Paystack request failed',
      );
    }

    return payload;
  }

  getConfig(): PaystackConfig {
    return {
      secretKey: this.getValue('PAYSTACK_SECRET_KEY'),
      publicKey: this.getValue('PAYSTACK_PUBLIC_KEY'),
      webhookSecret: this.getValue('PAYSTACK_WEBHOOK_SECRET'),
      defaultCurrency: this.getValue('PAYSTACK_DEFAULT_CURRENCY') ?? 'USD',
      subscriptionCallbackUrl: this.getValue(
        'PAYSTACK_SUBSCRIPTION_CALLBACK_URL',
      ),
      baseUrl:
        this.getValue('PAYSTACK_API_BASE_URL') ?? 'https://api.paystack.co',
    };
  }

  async createTransaction(input: {
    amount: number;
    currency?: string;
    email: string;
    tenantName: string;
    reference: string;
    callbackUrl?: string;
  }) {
    const paystackConfig = this.getConfig();
    const callbackUrl =
      input.callbackUrl ??
      paystackConfig.subscriptionCallbackUrl ??
      'http://localhost:5173/subscription/paystack/callback?reference={CHECKOUT_REFERENCE}';

    return this.callPaystack<{
      status: boolean;
      message: string;
      data: {
        authorization_url: string;
        access_code: string;
        reference: string;
      };
    }>('/transaction/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(Math.round(input.amount * 100)),
        email: input.email,
        currency: (
          input.currency ?? paystackConfig.defaultCurrency ?? 'USD'
        ).toUpperCase(),
        reference: input.reference,
        callback_url: callbackUrl.replace(
          '{CHECKOUT_REFERENCE}',
          input.reference,
        ),
        metadata: {
          tenantName: input.tenantName,
          subscriptionReference: input.reference,
        },
      }),
    });
  }

  verifyTransaction(reference: string) {
    return this.callPaystack<{
      status: boolean;
      message: string;
      data: {
        id: number;
        status:
          | 'success'
          | 'failed'
          | 'abandoned'
          | 'pending'
          | 'processing'
          | 'ongoing'
          | 'queued'
          | 'reversed';
        reference: string;
        gateway_response?: string | null;
        paid_at?: string | null;
      };
    }>(`/transaction/verify/${reference}`, {
      method: 'GET',
    });
  }
}
