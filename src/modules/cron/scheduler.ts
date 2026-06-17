import cron, { ScheduledTask } from 'node-cron';
import { prisma } from '../../config/db';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { createAuditLog } from '../audit/audit.service';
import { processDueRecurringTransactions } from '../recurring/recurring.service';

const logCron = (level: 'info' | 'error', message: string, data: Record<string, unknown> = {}) => {
  const payload = JSON.stringify({
    level,
    source: 'cron',
    message,
    timestamp: new Date().toISOString(),
    ...data,
  });

  if (level === 'error') {
    console.error(payload);
  } else {
    console.info(payload);
  }
};

export function initCronJobs(): ScheduledTask[] {
  const tasks: ScheduledTask[] = [];

  // 1. Process Recurring Transactions (Runs everyday at exactly midnight)
  const recurringTask = cron.schedule('0 0 * * *', async () => {
    logCron('info', 'Processing recurring transactions');
    const now = new Date();
    
    try {
      const count = await processDueRecurringTransactions(now);
      logCron('info', 'Processed recurring transactions', { count });
    } catch (e) {
      logCron('error', 'Error processing recurring transactions', {
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }, { name: 'process-recurring-transactions', noOverlap: true });
  tasks.push(recurringTask);

  // 2. End-of-month rollover to Savings Bucket (Runs at 23:59 on the last day of every month)
  const rolloverTask = cron.schedule('59 23 28-31 * *', async () => {
    // Determine if today is the last day of the month
    const today = new Date();
    const isEOM = today.getDate() === endOfMonth(today).getDate();
    if (!isEOM) return;

    logCron('info', 'Running end-of-month envelope rollover sweep');
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    try {
      const goals = await prisma.budgetGoal.findMany({
        where: { month: currentMonth, year: currentYear }
      });

      for (const goal of goals) {
        // Find total expenses for this category this month
        const expenses = await prisma.transaction.aggregate({
          where: {
            userId: goal.userId,
            categoryId: goal.categoryId,
            type: 'EXPENSE',
            date: {
              gte: startOfMonth(today),
              lte: endOfMonth(today)
            }
          },
          _sum: { amount: true }
        });

        const totalSpent = Number(expenses._sum.amount || 0);
        const limitAmt = Number(goal.limitAmount);
        
        if (limitAmt > totalSpent) {
          const unusedCredit = limitAmt - totalSpent;
          
          await prisma.$transaction(async (tx) => {
            let bucket = await tx.savingsBucket.findUnique({ where: { userId: goal.userId } });
            if (!bucket) {
              bucket = await tx.savingsBucket.create({ data: { userId: goal.userId } });
            }

            await tx.savingsBucket.update({
              where: { id: bucket.id },
              data: { balance: { increment: unusedCredit } }
            });

            await createAuditLog({
              userId: goal.userId,
              action: 'SAVINGS_ROLLOVER_CREDITED',
              entityType: 'BudgetGoal',
              entityId: goal.id,
              metadata: {
                categoryId: goal.categoryId,
                month: currentMonth,
                year: currentYear,
                limitAmount: goal.limitAmount.toString(),
                totalSpent,
                unusedCredit,
                bucketId: bucket.id,
              },
            }, tx);
          });
        }
      }
      logCron('info', 'End-of-month rollover complete', { month: currentMonth, year: currentYear });
    } catch (e) {
      logCron('error', 'Error doing end-of-month sweep', {
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }, { name: 'end-of-month-savings-rollover', noOverlap: true });
  tasks.push(rolloverTask);

  return tasks;
}
