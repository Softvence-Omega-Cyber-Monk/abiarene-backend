import { randomUUID } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type MtnMomoConfig = {
  baseUrl: string | null;
  subscriptionKey: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  targetEnvironment: string | null;
  webhookSecret: string | null;
  defaultCurrency: string | null;
  callbackUrl: string | null;
};

@Injectable()
export class MtnMomoPaymentProviderService {
  constructor(private readonly configService: ConfigService) {}

  private getValue(key: string) {
    return this.configService.get<string>(key) ?? null;
  }

  getConfig(): MtnMomoConfig {
    return {
      baseUrl: this.getValue('MTN_MOMO_BASE_URL'),
      subscriptionKey: this.getValue('MTN_MOMO_SUBSCRIPTION_KEY'),
      apiKey: this.getValue('MTN_MOMO_API_KEY'),
      apiSecret: this.getValue('MTN_MOMO_API_SECRET'),
      targetEnvironment: this.getValue('MTN_MOMO_TARGET_ENVIRONMENT'),
      webhookSecret: this.getValue('MTN_MOMO_WEBHOOK_SECRET'),
      defaultCurrency: this.getValue('MTN_MOMO_DEFAULT_CURRENCY') ?? 'EUR',
      callbackUrl: this.getValue('MTN_MOMO_CALLBACK_URL'),
    };
  }

  private assertConfig(config: MtnMomoConfig) {
    if (!config.baseUrl) {
      throw new InternalServerErrorException(
        'MTN MoMo is not configured: missing MTN_MOMO_BASE_URL',
      );
    }
    if (!config.subscriptionKey) {
      throw new InternalServerErrorException(
        'MTN MoMo is not configured: missing MTN_MOMO_SUBSCRIPTION_KEY',
      );
    }
    if (!config.apiKey) {
      throw new InternalServerErrorException(
        'MTN MoMo is not configured: missing MTN_MOMO_API_KEY',
      );
    }
    if (!config.apiSecret) {
      throw new InternalServerErrorException(
        'MTN MoMo is not configured: missing MTN_MOMO_API_SECRET',
      );
    }
    if (!config.targetEnvironment) {
      throw new InternalServerErrorException(
        'MTN MoMo is not configured: missing MTN_MOMO_TARGET_ENVIRONMENT',
      );
    }
  }

  private async getAccessToken() {
    const config = this.getConfig();
    this.assertConfig(config);

    const credentials = Buffer.from(
      `${config.apiKey}:${config.apiSecret}`,
      'utf8',
    ).toString('base64');

    const response = await fetch(`${config.baseUrl}/collection/token/`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Ocp-Apim-Subscription-Key': config.subscriptionKey!,
      },
    });

    const payload = (await response.json()) as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      message?: string;
    };

    if (!response.ok || !payload.access_token) {
      throw new InternalServerErrorException(
        payload.message ?? 'MTN MoMo token request failed',
      );
    }

    return payload.access_token;
  }

  async createRequestToPay(input: {
    amount: number;
    currency?: string;
    phoneNumber: string;
    tenantName: string;
    reference: string;
  }) {
    const config = this.getConfig();
    this.assertConfig(config);
    const accessToken = await this.getAccessToken();
    const requestReferenceId = randomUUID();

    const response = await fetch(`${config.baseUrl}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Reference-Id': requestReferenceId,
        'X-Target-Environment': config.targetEnvironment!,
        'Ocp-Apim-Subscription-Key': config.subscriptionKey!,
        'Content-Type': 'application/json',
        ...(config.callbackUrl
          ? {
              'X-Callback-Url': config.callbackUrl,
            }
          : {}),
      },
      body: JSON.stringify({
        amount: input.amount.toFixed(2),
        currency: (
          input.currency ?? config.defaultCurrency ?? 'EUR'
        ).toUpperCase(),
        externalId: input.reference,
        payer: {
          partyIdType: 'MSISDN',
          partyId: input.phoneNumber,
        },
        payerMessage: `${input.tenantName} subscription`,
        payeeNote: `Subscription payment ${input.reference}`,
      }),
    });

    if (!response.ok && response.status !== 202) {
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      throw new InternalServerErrorException(
        payload?.message ?? 'MTN MoMo request-to-pay failed',
      );
    }

    return {
      referenceId: requestReferenceId,
      status: response.status,
    };
  }

  async getRequestToPayStatus(referenceId: string) {
    const config = this.getConfig();
    this.assertConfig(config);
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `${config.baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Target-Environment': config.targetEnvironment!,
          'Ocp-Apim-Subscription-Key': config.subscriptionKey!,
        },
      },
    );

    const payload = (await response.json()) as {
      amount?: string;
      currency?: string;
      financialTransactionId?: string;
      externalId?: string;
      payer?: {
        partyIdType?: string;
        partyId?: string;
      };
      status?: string;
      reason?: string;
      message?: string;
    };

    if (!response.ok) {
      throw new InternalServerErrorException(
        payload.message ?? 'MTN MoMo payment status request failed',
      );
    }

    return payload;
  }
}
