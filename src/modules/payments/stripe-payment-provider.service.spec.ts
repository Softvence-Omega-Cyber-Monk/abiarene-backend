import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripePaymentProviderService } from './stripe-payment-provider.service.js';

describe('StripePaymentProviderService', () => {
  let service: StripePaymentProviderService;
  const mockSecretKey = 'sk_test_mock_1234567890abcdefghijklmn';
  const mockWebhookSecret = 'whsec_mock_1234567890abcdefghijklmn';

  beforeEach(() => {
    const configService = {
      get: (key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return mockSecretKey;
        if (key === 'STRIPE_WEBHOOK_SECRET') return mockWebhookSecret;
        if (key === 'STRIPE_DEFAULT_CURRENCY') return 'usd';
        return null;
      },
    } as unknown as ConfigService;

    service = new StripePaymentProviderService(configService);
  });

  it('should return correct stripe configuration', () => {
    const config = service.getConfig();
    expect(config.secretKey).toBe(mockSecretKey);
    expect(config.webhookSecret).toBe(mockWebhookSecret);
    expect(config.defaultCurrency).toBe('usd');
  });

  it('should verify and construct valid stripe webhook event', () => {
    const stripe = new Stripe(mockSecretKey);
    const mockPayload = JSON.stringify({
      id: 'evt_test_mock_123',
      object: 'event',
      api_version: '2025-01-27.acacia',
      created: 1700000000,
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_mock_123',
          client_reference_id: 'REF_123',
        },
      },
    });

    const header = stripe.webhooks.generateTestHeaderString({
      payload: mockPayload,
      secret: mockWebhookSecret,
    });

    const event = service.constructWebhookEvent(Buffer.from(mockPayload, 'utf8'), header);
    expect(event.id).toBe('evt_test_mock_123');
    expect(event.type).toBe('checkout.session.completed');
  });

  it('should reject invalid webhook signature', () => {
    const mockPayload = JSON.stringify({ id: 'evt_test', type: 'test' });
    expect(() => {
      service.constructWebhookEvent(
        Buffer.from(mockPayload, 'utf8'),
        't=1700000000,v1=invalid_signature',
      );
    }).toThrow('Stripe webhook signature verification failed');
  });
});
