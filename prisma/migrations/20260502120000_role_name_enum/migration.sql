DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "roles"
    WHERE LOWER("name") NOT IN ('manager', 'server', 'kitchen', 'cashier', 'admin')
  ) THEN
    RAISE EXCEPTION 'roles.name contains unsupported values for RoleName enum';
  END IF;
END $$;

CREATE TYPE "RoleName" AS ENUM ('manager', 'server', 'kitchen', 'cashier', 'admin');

ALTER TABLE "roles" ADD COLUMN "name_new" "RoleName";

UPDATE "roles"
SET "name_new" = LOWER("name")::"RoleName";

DROP INDEX "roles_name_tenantId_key";

ALTER TABLE "roles" DROP COLUMN "name";
ALTER TABLE "roles" RENAME COLUMN "name_new" TO "name";
ALTER TABLE "roles" ALTER COLUMN "name" SET NOT NULL;

CREATE UNIQUE INDEX "roles_name_tenantId_key" ON "roles"("name", "tenantId");
