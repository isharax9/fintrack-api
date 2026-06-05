import cron from 'node-cron';
import { prisma } from '../../config/db';
import { addDays, addWeeks, addMonths, addYears, format, startOfMonth, endOfMonth } from 'date-fns';
import { createAuditLog } from '../audit/audit.service';

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

export function initCronJobs() {
  // 1. Process Recurring Transactions (Runs everyday at exactly midnight)
  cron.schedule('0 0 * * *', async () => {
    logCron('info', 'Processing recurring transactions');
    const now = new Date();
    
    try {
      const recurrings = await prisma.recurringTransaction.findMany({
        where: {
          isActive: true,
          nextDate: { lte: now }
        }
      });

      for (const rec of recurrings) {
        await prisma.$transaction(async (tx) => {
          // Add transaction
          const incrementValue = rec.type === 'INCOME' ? rec.amount : -rec.amount;

          const transaction = await tx.transaction.create({
            data: {
              userId: rec.userId,
              accountId: rec.accountId,
              categoryId: rec.categoryId,
              title: rec.title,
              amount: rec.amount,
              type: rec.type,
              notes: rec.notes,
              date: new Date()
            }
          });

          // Adjust account balance
          await tx.account.update({
            where: { id: rec.accountId },
            data: { balance: { increment: incrementValue } }
          });

          // Update nextDate
          let nextDate = new Date(rec.nextDate);
          if (rec.frequency === 'DAILY') nextDate = addDays(nextDate, 1);
          if (rec.frequency === 'WEEKLY') nextDate = addWeeks(nextDate, 1);
          if (rec.frequency === 'BIWEEKLY') nextDate = addWeeks(nextDate, 2);
          if (rec.frequency === 'MONTHLY') nextDate = addMonths(nextDate, 1);
          if (rec.frequency === 'YEARLY') nextDate = addYears(nextDate, 1);

          await tx.recurringTransaction.update({
            where: { id: rec.id },
            data: { nextDate }
          });

          await createAuditLog({
            userId: rec.userId,
            action: 'RECURRING_EXECUTED',
            entityType: 'RecurringTransaction',
            entityId: rec.id,
            metadata: {
              transactionId: transaction.id,
              accountId: rec.accountId,
              categoryId: rec.categoryId,
              type: rec.type,
              frequency: rec.frequency,
              amount: rec.amount.toString(),
              previousNextDate: rec.nextDate.toISOString(),
              nextDate: nextDate.toISOString(),
            },
          }, tx);
        });
      }
      logCron('info', 'Processed recurring transactions', { count: recurrings.length });
    } catch (e) {
      logCron('error', 'Error processing recurring transactions', {
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  });

  // 2. End-of-month rollover to Savings Bucket (Runs at 23:59 on the last day of every month)
  cron.schedule('59 23 28-31 * *', async () => {
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
  });
}
