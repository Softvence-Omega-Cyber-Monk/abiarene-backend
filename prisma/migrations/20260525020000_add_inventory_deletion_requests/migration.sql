CREATE TYPE "InventoryDeletionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "inventory_deletion_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productSku" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "status" "InventoryDeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_deletion_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_deletion_requests_tenantId_status_createdAt_idx"
ON "inventory_deletion_requests"("tenantId", "status", "createdAt");

CREATE UNIQUE INDEX "inventory_deletion_requests_tenantId_productId_status_key"
ON "inventory_deletion_requests"("tenantId", "productId", "status");

ALTER TABLE "inventory_deletion_requests"
ADD CONSTRAINT "inventory_deletion_requests_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_deletion_requests"
ADD CONSTRAINT "inventory_deletion_requests_requestedByUserId_fkey"
FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_deletion_requests"
ADD CONSTRAINT "inventory_deletion_requests_approvedByUserId_fkey"
FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
