DROP INDEX IF EXISTS "users_pin_tenantId_idx";
CREATE UNIQUE INDEX "users_roleId_pin_key" ON "users"("roleId", "pin");
