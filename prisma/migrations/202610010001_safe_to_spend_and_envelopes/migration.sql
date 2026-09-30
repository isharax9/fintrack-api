-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paydayDay" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paydayAmount" DECIMAL(16,2);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "householdEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "householdName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyPaydayReminders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifyWeeklyDigest" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE IF NOT EXISTS "EnvelopeTransfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromCategoryId" TEXT NOT NULL,
    "toCategoryId" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvelopeTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EnvelopeTransfer_userId_month_year_idx" ON "EnvelopeTransfer"("userId", "month", "year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EnvelopeTransfer_userId_fromCategoryId_idx" ON "EnvelopeTransfer"("userId", "fromCategoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EnvelopeTransfer_userId_toCategoryId_idx" ON "EnvelopeTransfer"("userId", "toCategoryId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EnvelopeTransfer_userId_fkey'
  ) THEN
    ALTER TABLE "EnvelopeTransfer" ADD CONSTRAINT "EnvelopeTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
