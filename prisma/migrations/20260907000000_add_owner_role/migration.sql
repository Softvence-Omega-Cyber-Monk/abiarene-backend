-- Add OWNER to RoleName (tenant owner role).
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'OWNER';

-- Support messages: SUPERVISOR sender role becomes OWNER (DB reset path; remap any leftovers).
ALTER TYPE "SupportMessageSenderRole" RENAME TO "SupportMessageSenderRole_old";

CREATE TYPE "SupportMessageSenderRole" AS ENUM ('ADMIN', 'OWNER');

ALTER TABLE "support_ticket_messages"
ALTER COLUMN "senderRole" TYPE "SupportMessageSenderRole"
USING (
  CASE
    WHEN "senderRole"::text = 'SUPERVISOR' THEN 'OWNER'::"SupportMessageSenderRole"
    WHEN "senderRole"::text = 'MANAGER' THEN 'OWNER'::"SupportMessageSenderRole"
    ELSE "senderRole"::text::"SupportMessageSenderRole"
  END
);

DROP TYPE "SupportMessageSenderRole_old";
