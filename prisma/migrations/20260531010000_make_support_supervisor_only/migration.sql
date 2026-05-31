ALTER TYPE "SupportMessageSenderRole" RENAME TO "SupportMessageSenderRole_old";

CREATE TYPE "SupportMessageSenderRole" AS ENUM ('ADMIN', 'SUPERVISOR');

ALTER TABLE "support_ticket_messages"
ALTER COLUMN "senderRole" TYPE "SupportMessageSenderRole"
USING (
  CASE
    WHEN "senderRole"::text = 'MANAGER' THEN 'SUPERVISOR'::"SupportMessageSenderRole"
    ELSE "senderRole"::text::"SupportMessageSenderRole"
  END
);

DROP TYPE "SupportMessageSenderRole_old";
