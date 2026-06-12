CREATE TABLE "subscription_prices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL DEFAULT 'restaurant',
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_prices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscription_prices_industry_isActive_idx" ON "subscription_prices"("industry", "isActive");
CREATE INDEX "subscription_prices_createdById_idx" ON "subscription_prices"("createdById");

ALTER TABLE "subscription_prices"
ADD CONSTRAINT "subscription_prices_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
