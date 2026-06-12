WITH ranked_subscription_prices AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "planType"
      ORDER BY "isActive" DESC, "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS row_number
  FROM "subscription_prices"
)
DELETE FROM "subscription_prices" AS subscription_prices
USING ranked_subscription_prices
WHERE subscription_prices."id" = ranked_subscription_prices."id"
  AND ranked_subscription_prices.row_number > 1;

DROP INDEX IF EXISTS "subscription_prices_industry_planType_key";
DROP INDEX IF EXISTS "subscription_prices_industry_isActive_idx";

ALTER TABLE "subscription_prices"
DROP COLUMN IF EXISTS "industry";

CREATE UNIQUE INDEX "subscription_prices_planType_key"
ON "subscription_prices"("planType");

CREATE INDEX "subscription_prices_isActive_idx"
ON "subscription_prices"("isActive");
