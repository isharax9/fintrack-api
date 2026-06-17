CREATE TYPE "TransferStatus" AS ENUM ('POSTED', 'REVERSED', 'REVERSAL');

ALTER TABLE "Transfer" ADD COLUMN "status" "TransferStatus" NOT NULL DEFAULT 'POSTED',
ADD COLUMN "reversedAt" TIMESTAMP(3),
ADD COLUMN "reversalOfId" TEXT;

CREATE UNIQUE INDEX "Transfer_reversalOfId_key" ON "Transfer"("reversalOfId");
CREATE INDEX "Transfer_userId_status_date_idx" ON "Transfer"("userId", "status", "date");
CREATE INDEX "Transfer_userId_fromAccountId_date_idx" ON "Transfer"("userId", "fromAccountId", "date");
CREATE INDEX "Transfer_userId_toAccountId_date_idx" ON "Transfer"("userId", "toAccountId", "date");

ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
