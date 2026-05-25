DROP INDEX IF EXISTS "users_roleId_pin_key";

ALTER TABLE "users"
ALTER COLUMN "pin" DROP NOT NULL;
