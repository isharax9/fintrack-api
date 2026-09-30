import cron, { ScheduledTask } from 'node-cron';
import { prisma } from '../../config/db';
import { format, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { createAuditLog } from '../audit/audit.service';
import { processDueRecurringTransactions } from '../recurring/recurring.service';
import {
  sendBillReminderEmail,
  sendMonthlyReportEmail,
  sendPaydayReminderEmail,
  sendWeekendSafeToSpendDigestEmail,
} from '../../utils/email';
import { getSafeToSpend } from '../reports/reports.service';


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

  // ── 1. Process Recurring Transactions (daily at midnight) ─────────────────
  const recurringTask = cron.schedule(
    '0 0 * * *',
    async () => {
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
    },
    { name: 'process-recurring-transactions', noOverlap: true },
  );
  tasks.push(recurringTask);

  // ── 2. End-of-month savings rollover (23:59 on last day of month) ─────────
  const rolloverTask = cron.schedule(
    '59 23 28-31 * *',
    async () => {
      const today = new Date();
      const isEOM = today.getDate() === endOfMonth(today).getDate();
      if (!isEOM) return;

      logCron('info', 'Running end-of-month envelope rollover sweep');
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();

      try {
        const goals = await prisma.budgetGoal.findMany({
          where: { month: currentMonth, year: currentYear },
        });

        for (const goal of goals) {
          const expenses = await prisma.transaction.aggregate({
            where: {
              userId: goal.userId,
              categoryId: goal.categoryId,
              type: 'EXPENSE',
              date: { gte: startOfMonth(today), lte: endOfMonth(today) },
            },
            _sum: { amount: true },
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
                data: { balance: { increment: unusedCredit } },
              });

              await createAuditLog(
                {
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
                },
                tx,
              );
            });
          }
        }
        logCron('info', 'End-of-month rollover complete', {
          month: currentMonth,
          year: currentYear,
        });
      } catch (e) {
        logCron('error', 'Error doing end-of-month sweep', {
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    },
    { name: 'end-of-month-savings-rollover', noOverlap: true },
  );
  tasks.push(rolloverTask);

  // ── 3. Daily bill reminder emails (08:00 every morning) ───────────────────
  //    Sends ONE digest email per user for bills due within the next 7 days.
  const billReminderTask = cron.schedule(
    '0 8 * * *',
    async () => {
      logCron('info', 'Sending daily bill reminder emails');
      const now = new Date();
      const sevenDaysFromNow = addDays(now, 7);

      try {
        // Find all active recurring transactions due within 7 days
        const dueSoon = await prisma.recurringTransaction.findMany({
          where: {
            isActive: true,
            nextDate: { gte: now, lte: sevenDaysFromNow },
          },
          include: { user: { select: { id: true, email: true, name: true, notifyBillReminders: true } } },
        });

        // Group by user
        const byUser = new Map<
          string,
          {
            user: { email: string; name: string };
            bills: Array<{ title: string; amount: number; dueDate: string; frequency: string }>;
          }
        >();

        for (const r of dueSoon) {
          if (!r.user.notifyBillReminders) continue;

          const entry = byUser.get(r.userId) ?? { user: r.user, bills: [] };
          entry.bills.push({
            title: r.title,
            amount: Number(r.amount),
            dueDate: r.nextDate.toISOString().slice(0, 10),
            frequency: r.frequency,
          });
          byUser.set(r.userId, entry);
        }

        let sent = 0;
        for (const { user, bills } of byUser.values()) {
          try {
            await sendBillReminderEmail({ to: user.email, userName: user.name, bills });
            sent++;
          } catch (err) {
            logCron('error', 'Failed to send bill reminder email', {
              email: user.email,
              error: err instanceof Error ? err.message : 'Unknown',
            });
          }
        }

        logCron('info', 'Daily bill reminder emails sent', { sent });
      } catch (e) {
        logCron('error', 'Error sending bill reminder emails', {
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    },
    { name: 'daily-bill-reminders', noOverlap: true },
  );
  tasks.push(billReminderTask);

  // ── 4. Monthly financial report emails (1st of each month at 09:00) ───────
  const monthlyReportTask = cron.schedule(
    '0 9 1 * *',
    async () => {
      logCron('info', 'Sending monthly financial report emails');

      const today = new Date();
      // Report covers the *previous* month
      const reportDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const monthLabel = format(reportDate, 'MMMM yyyy');
      const rangeStart = startOfMonth(reportDate);
      const rangeEnd = endOfMonth(reportDate);

      try {
        const users = await prisma.user.findMany({
          where: { notifyMonthlyReports: true },
          select: { id: true, email: true, name: true },
        });

        let sent = 0;
        for (const user of users) {
          try {
            // Aggregate income and expenses for the previous month
            const [incomeAgg, expenseAgg, topCategories] = await Promise.all([
              prisma.transaction.aggregate({
                where: { userId: user.id, type: 'INCOME', date: { gte: rangeStart, lte: rangeEnd } },
                _sum: { amount: true },
              }),
              prisma.transaction.aggregate({
                where: { userId: user.id, type: 'EXPENSE', date: { gte: rangeStart, lte: rangeEnd } },
                _sum: { amount: true },
              }),
              // Top 5 expense categories by total spend
              prisma.transaction.groupBy({
                by: ['categoryId'],
                where: { userId: user.id, type: 'EXPENSE', date: { gte: rangeStart, lte: rangeEnd } },
                _sum: { amount: true },
                orderBy: { _sum: { amount: 'desc' } },
                take: 5,
              }),
            ]);

            const totalIncome = Number(incomeAgg._sum.amount || 0);
            const totalExpenses = Number(expenseAgg._sum.amount || 0);
            const netSavings = totalIncome - totalExpenses;

            // Resolve category names
            const categoryIds = topCategories.map((c) => c.categoryId);
            const categories = await prisma.category.findMany({
              where: { id: { in: categoryIds } },
              select: { id: true, name: true },
            });
            const catMap = new Map(categories.map((c) => [c.id, c.name]));

            const topCategoryPayload = topCategories.map((c) => ({
              name: catMap.get(c.categoryId) ?? 'Unknown',
              amount: Number(c._sum.amount || 0),
              percent:
                totalExpenses > 0
                  ? Math.round((Number(c._sum.amount || 0) / totalExpenses) * 100)
                  : 0,
            }));

            await sendMonthlyReportEmail({
              to: user.email,
              userName: user.name,
              month: monthLabel,
              totalIncome,
              totalExpenses,
              netSavings,
              topCategories: topCategoryPayload,
            });

            sent++;
          } catch (err) {
            logCron('error', 'Failed to send monthly report to user', {
              userId: user.id,
              error: err instanceof Error ? err.message : 'Unknown',
            });
          }
        }

        logCron('info', 'Monthly report emails sent', { sent, month: monthLabel });
      } catch (e) {
        logCron('error', 'Error sending monthly report emails', {
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    },
    { name: 'monthly-report-emails', noOverlap: true },
  );
  tasks.push(monthlyReportTask);

  // ── 5. Payday & Salary Reminder emails (08:30 every morning) ─────────────
  const paydayReminderTask = cron.schedule(
    '30 8 * * *',
    async () => {
      logCron('info', 'Running daily payday reminder email check');
      const now = new Date();

      try {
        const users = await prisma.user.findMany({
          where: { notifyPaydayReminders: true },
          select: { id: true, email: true, name: true, paydayDay: true },
        });

        let sent = 0;
        for (const user of users) {
          try {
            const safeData = await getSafeToSpend(user.id);
            if (safeData.daysUntilPayday <= 1) {
              const isPaydayToday = safeData.daysUntilPayday === 1 && now.getDate() === (user.paydayDay || 25);
              await sendPaydayReminderEmail({
                to: user.email,
                userName: user.name,
                expectedSalary: safeData.expectedPaydayAmount,
                currentCash: safeData.currentCash,
                billsBeforeSalary: safeData.billsBeforeSalary,
                safeToSpend: safeData.safeToSpend,
                safeDailySpending: safeData.safeDailySpending,
                daysUntilPayday: safeData.daysUntilPayday,
                currency: safeData.currency,
                isPaydayToday,
              });
              sent++;
            }
          } catch (err) {
            logCron('error', 'Failed to send payday reminder to user', {
              userId: user.id,
              error: err instanceof Error ? err.message : 'Unknown',
            });
          }
        }
        logCron('info', 'Payday reminder emails sent', { sent });
      } catch (e) {
        logCron('error', 'Error in payday reminder cron', {
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    },
    { name: 'payday-reminder-emails', noOverlap: true },
  );
  tasks.push(paydayReminderTask);

  // ── 6. Friday Weekend Safe-to-Spend Digest (15:00 every Friday) ──────────
  const weekendDigestTask = cron.schedule(
    '0 15 * * 5',
    async () => {
      logCron('info', 'Running Friday weekend safe-to-spend digest');

      try {
        const users = await prisma.user.findMany({
          where: { notifyWeeklyDigest: true },
          select: { id: true, email: true, name: true },
        });

        let sent = 0;
        for (const user of users) {
          try {
            const safeData = await getSafeToSpend(user.id);
            await sendWeekendSafeToSpendDigestEmail({
              to: user.email,
              userName: user.name,
              safeToSpend: safeData.safeToSpend,
              safeDailySpending: safeData.safeDailySpending,
              daysUntilPayday: safeData.daysUntilPayday,
              upcomingBillsCount: safeData.upcomingBills.length,
              upcomingBillsAmount: safeData.billsBeforeSalary,
              currency: safeData.currency,
            });
            sent++;
          } catch (err) {
            logCron('error', 'Failed to send weekend digest to user', {
              userId: user.id,
              error: err instanceof Error ? err.message : 'Unknown',
            });
          }
        }
        logCron('info', 'Friday weekend digest emails sent', { sent });
      } catch (e) {
        logCron('error', 'Error in weekend digest cron', {
          error: e instanceof Error ? e.message : 'Unknown error',
        });
      }
    },
    { name: 'weekend-safe-to-spend-digest', noOverlap: true },
  );
  tasks.push(weekendDigestTask);

  return tasks;
}

