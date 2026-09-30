-- AlterTable
ALTER TABLE "User" ADD COLUMN "paydayDay" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN "paydayAmount" DECIMAL(16,2),
ADD COLUMN "householdEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "householdName" TEXT,
ADD COLUMN "notifyPaydayReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "notifyWeeklyDigest" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "EnvelopeTransfer" (
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
CREATE INDEX "EnvelopeTransfer_userId_month_year_idx" ON "EnvelopeTransfer"("userId", "month", "year");

-- CreateIndex
CREATE INDEX "EnvelopeTransfer_userId_fromCategoryId_idx" ON "EnvelopeTransfer"("userId", "fromCategoryId");

-- CreateIndex
CREATE INDEX "EnvelopeTransfer_userId_toCategoryId_idx" ON "EnvelopeTransfer"("userId", "toCategoryId");

-- AddForeignKey
ALTER TABLE "EnvelopeTransfer" ADD CONSTRAINT "EnvelopeTransfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
