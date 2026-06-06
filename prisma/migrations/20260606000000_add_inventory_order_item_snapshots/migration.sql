ALTER TABLE "tenants"
ALTER COLUMN "industry" SET DEFAULT 'business';

ALTER TABLE "subscription_prices"
ALTER COLUMN "industry" SET DEFAULT 'business';

ALTER TABLE "order_items"
DROP CONSTRAINT "order_items_menuItemId_fkey";

ALTER TABLE "order_items"
ALTER COLUMN "menuItemId" DROP NOT NULL,
ADD COLUMN "productId" TEXT,
ADD COLUMN "itemName" TEXT,
ADD COLUMN "itemCategory" TEXT,
ADD COLUMN "itemImage" TEXT,
ADD COLUMN "unitPrice" DOUBLE PRECISION;

UPDATE "order_items" AS oi
SET
  "itemName" = mi."name",
  "itemCategory" = mi."category",
  "itemImage" = mi."image",
  "unitPrice" = mi."price"
FROM "menu_items" AS mi
WHERE oi."menuItemId" = mi."id";

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_menuItemId_fkey"
FOREIGN KEY ("menuItemId") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "order_items_menuItemId_idx" ON "order_items"("menuItemId");
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");
