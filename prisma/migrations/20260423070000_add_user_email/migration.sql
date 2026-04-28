-- AlterTable
ALTER TABLE "users" ADD COLUMN "email" TEXT;

-- Backfill existing users so the column can be enforced as required.
UPDATE "users"
SET "email" = "id" || '@local.invalid'
WHERE "email" IS NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
