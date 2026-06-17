-- CreateEnum
CREATE TYPE "RecurringExecutionStatus" AS ENUM ('SUCCESS', 'SKIPPED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecurringExecutionTrigger" AS ENUM ('AUTO', 'RUN_NOW', 'SKIP');

-- CreateTable
CREATE TABLE "RecurringExecution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recurringId" TEXT NOT NULL,
    "transactionId" TEXT,
    "categoryId" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RecurringExecutionStatus" NOT NULL,
    "trigger" "RecurringExecutionTrigger" NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringExecution_userId_executedAt_idx" ON "RecurringExecution"("userId", "executedAt");

-- CreateIndex
CREATE INDEX "RecurringExecution_recurringId_executedAt_idx" ON "RecurringExecution"("recurringId", "executedAt");

-- CreateIndex
CREATE INDEX "RecurringExecution_status_executedAt_idx" ON "RecurringExecution"("status", "executedAt");

-- AddForeignKey
ALTER TABLE "RecurringExecution" ADD CONSTRAINT "RecurringExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExecution" ADD CONSTRAINT "RecurringExecution_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExecution" ADD CONSTRAINT "RecurringExecution_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExecution" ADD CONSTRAINT "RecurringExecution_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
