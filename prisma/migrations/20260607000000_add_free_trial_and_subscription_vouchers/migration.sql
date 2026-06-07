ALTER TABLE "tenants"
ADD COLUMN "startsWithFreeTrial" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "subscription_payments"
ADD COLUMN "voucherId" TEXT,
ADD COLUMN "originalAmount" DOUBLE PRECISION,
ADD COLUMN "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "subscription_payments"
SET "originalAmount" = "amount"
WHERE "originalAmount" IS NULL;

CREATE TABLE "subscription_vouchers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amountOff" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "reservedByPaymentId" TEXT,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "usedInPaymentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_vouchers_tenantId_code_key" ON "subscription_vouchers"("tenantId", "code");
CREATE UNIQUE INDEX "subscription_vouchers_usedInPaymentId_key" ON "subscription_vouchers"("usedInPaymentId");
CREATE INDEX "subscription_vouchers_tenantId_isActive_idx" ON "subscription_vouchers"("tenantId", "isActive");
CREATE INDEX "subscription_vouchers_createdById_idx" ON "subscription_vouchers"("createdById");
CREATE INDEX "subscription_vouchers_usedByUserId_idx" ON "subscription_vouchers"("usedByUserId");
CREATE INDEX "subscription_payments_voucherId_idx" ON "subscription_payments"("voucherId");

ALTER TABLE "subscription_payments"
ADD CONSTRAINT "subscription_payments_voucherId_fkey"
FOREIGN KEY ("voucherId") REFERENCES "subscription_vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subscription_vouchers"
ADD CONSTRAINT "subscription_vouchers_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_vouchers"
ADD CONSTRAINT "subscription_vouchers_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_vouchers"
ADD CONSTRAINT "subscription_vouchers_usedByUserId_fkey"
FOREIGN KEY ("usedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "subscription_vouchers"
ADD CONSTRAINT "subscription_vouchers_usedInPaymentId_fkey"
FOREIGN KEY ("usedInPaymentId") REFERENCES "subscription_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
