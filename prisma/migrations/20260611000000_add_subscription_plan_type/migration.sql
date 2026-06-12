CREATE TYPE "SubscriptionPlanType" AS ENUM ('FREE', 'MONTHLY', 'YEARLY');

ALTER TABLE "subscription_prices"
ADD COLUMN "planType" "SubscriptionPlanType" NOT NULL DEFAULT 'MONTHLY';

UPDATE "subscription_prices"
SET "planType" = CASE
  WHEN UPPER("name") LIKE '%FREE%' THEN 'FREE'::"SubscriptionPlanType"
  WHEN UPPER("name") LIKE '%YEAR%' THEN 'YEARLY'::"SubscriptionPlanType"
  ELSE 'MONTHLY'::"SubscriptionPlanType"
END;

UPDATE "subscription_prices"
SET "name" = CASE
  WHEN "planType" = 'FREE' THEN 'Free Plan'
  WHEN "planType" = 'YEARLY' THEN 'Yearly Plan'
  ELSE 'Monthly Plan'
END;

CREATE UNIQUE INDEX "subscription_prices_industry_planType_key"
ON "subscription_prices"("industry", "planType");
