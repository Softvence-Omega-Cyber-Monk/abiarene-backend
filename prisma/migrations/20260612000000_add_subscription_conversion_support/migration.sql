ALTER TABLE "tenants"
ADD COLUMN "subscriptionCurrencyCode" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "subscription_payments"
ADD COLUMN "originalCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN "exchangeRate" DOUBLE PRECISION;
