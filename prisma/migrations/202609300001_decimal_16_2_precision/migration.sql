-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "Transfer" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "BudgetGoal" ALTER COLUMN "limitAmount" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "SavingsBucket" ALTER COLUMN "balance" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "SavingsGoal" ALTER COLUMN "targetAmount" SET DATA TYPE DECIMAL(16,2),
ALTER COLUMN "currentAmount" SET DATA TYPE DECIMAL(16,2);

-- AlterTable
ALTER TABLE "RecurringTransaction" ALTER COLUMN "amount" SET DATA TYPE DECIMAL(16,2);
