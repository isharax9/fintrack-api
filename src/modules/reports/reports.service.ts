import { prisma } from '../../config/db';
import { ReportQuery, SimulateSpendInput } from './reports.schema';
import { TransactionType } from '@prisma/client';
import { getMonthDateRangeUTC } from '../../utils/date';
import { addDays, differenceInCalendarDays } from 'date-fns';
import { sendQuickSnapshotEmail } from '../../utils/email';
import { notFound } from '../../utils/errors';


export const getSummary = async (userId: string, query: ReportQuery) => {
  const { startDate, endDate } = getMonthDateRangeUTC(query.year, query.month);


  const transactions = await prisma.transaction.groupBy({
    by: ['type'],
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true }
  });

  let totalIncome = 0;
  let totalExpense = 0;

  transactions.forEach(t => {
    if (t.type === TransactionType.INCOME) totalIncome += Number(t._sum.amount || 0);
    if (t.type === TransactionType.EXPENSE) totalExpense += Number(t._sum.amount || 0);
  });

  const netCashFlow = totalIncome - totalExpense;
  const cashFlowRate = totalIncome > 0 ? (netCashFlow / totalIncome) * 100 : 0;

  return {
    totalIncome,
    totalExpense,
    netCashFlow,
    cashFlowRate,
    // Backward-compatible aliases. The UI should prefer netCashFlow/cashFlowRate.
    netSavings: netCashFlow,
    savingsRate: Math.max(0, cashFlowRate),
  };
};

export const getByCategory = async (userId: string, query: ReportQuery) => {
  const { startDate, endDate } = getMonthDateRangeUTC(query.year, query.month);

  const expenses = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      type: TransactionType.EXPENSE,
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true }
  });

  // Get categories to attach names
  const categoryIds = expenses.map(e => e.categoryId);
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } }
  });

  const result = expenses.map(e => {
    const category = categories.find(c => c.id === e.categoryId);
    return {
      categoryId: e.categoryId,
      categoryName: category?.name || 'Unknown',
      color: category?.color || '#ccc',
      icon: category?.icon || 'help-circle',
      amount: Number(e._sum.amount || 0)
    };
  });

  return result.sort((a, b) => b.amount - a.amount);
};

export const getCategoryFlow = async (userId: string, query: ReportQuery) => {
  const { startDate, endDate } = getMonthDateRangeUTC(query.year, query.month);


  const flows = await prisma.transaction.groupBy({
    by: ['categoryId', 'type'],
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
  });

  const categoryIds = [...new Set(flows.map((flow) => flow.categoryId))];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds }, userId },
  });

  const byCategory = new Map<string, {
    categoryId: string;
    categoryName: string;
    color: string;
    icon: string;
    incomeAmount: number;
    expenseAmount: number;
    netAmount: number;
  }>();

  for (const flow of flows) {
    const category = categories.find((item) => item.id === flow.categoryId);
    const current = byCategory.get(flow.categoryId) || {
      categoryId: flow.categoryId,
      categoryName: category?.name || 'Unknown',
      color: category?.color || '#ccc',
      icon: category?.icon || 'help-circle',
      incomeAmount: 0,
      expenseAmount: 0,
      netAmount: 0,
    };
    const amount = Number(flow._sum.amount || 0);
    if (flow.type === TransactionType.INCOME) current.incomeAmount += amount;
    if (flow.type === TransactionType.EXPENSE) current.expenseAmount += amount;
    current.netAmount = current.incomeAmount - current.expenseAmount;
    byCategory.set(flow.categoryId, current);
  }

  return Array.from(byCategory.values()).sort((a, b) =>
    (b.incomeAmount + b.expenseAmount) - (a.incomeAmount + a.expenseAmount),
  );
};

export const getTrend = async (userId: string) => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1); // 6 months total

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: startDate }
    },
    select: { date: true, type: true, amount: true }
  });

  // Group by month
  const trendMap = new Map();
  
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    trendMap.set(key, { month: key, income: 0, expense: 0 });
  }

  transactions.forEach(t => {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
    if (trendMap.has(key)) {
      const current = trendMap.get(key);
      if (t.type === TransactionType.INCOME) current.income += Number(t.amount);
      if (t.type === TransactionType.EXPENSE) current.expense += Number(t.amount);
    }
  });

  return Array.from(trendMap.values()).sort((a, b) => a.month.localeCompare(b.month));
};

export const getSafeToSpend = async (userId: string) => {
  const now = new Date();

  // 1. User preferences & payday configuration
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      currency: true,
      paydayDay: true,
      paydayAmount: true,
      householdEnabled: true,
      householdName: true,
    },
  });
  if (!user) throw notFound('User not found');

  const currency = user.currency || 'USD';
  const paydayDay = Math.min(31, Math.max(1, user.paydayDay || 25));
  let expectedPaydayAmount = user.paydayAmount ? Number(user.paydayAmount) : 0;

  // 2. Liquid cash
  const accounts = await prisma.account.findMany({
    where: { userId },
  });
  const liquidAccounts = accounts.filter((a) => ['BANK', 'CASH', 'WALLET'].includes(a.type));
  const currentCash = liquidAccounts.length > 0
    ? liquidAccounts.reduce((sum, a) => sum + Number(a.balance), 0)
    : accounts.reduce((sum, a) => sum + Math.max(0, Number(a.balance)), 0);

  // 3. Next payday date calculation
  const recurringIncomes = await prisma.recurringTransaction.findMany({
    where: { userId, isActive: true, type: TransactionType.INCOME },
    orderBy: { nextDate: 'asc' },
  });

  let nextPaydayDate: Date;
  const todayDateOnly = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  if (recurringIncomes.length > 0) {
    const nextIncome = recurringIncomes[0];
    const incomeNextDate = new Date(nextIncome.nextDate);
    if (incomeNextDate >= todayDateOnly) {
      nextPaydayDate = incomeNextDate;
    } else {
      nextPaydayDate = addDays(todayDateOnly, 14);
    }
    if (expectedPaydayAmount === 0) {
      expectedPaydayAmount = Number(nextIncome.amount);
    }
  } else {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    if (currentDay < paydayDay) {
      nextPaydayDate = new Date(Date.UTC(currentYear, currentMonth, paydayDay));
    } else if (currentDay === paydayDay) {
      nextPaydayDate = new Date(Date.UTC(currentYear, currentMonth, paydayDay));
    } else {
      nextPaydayDate = new Date(Date.UTC(currentYear, currentMonth + 1, paydayDay));
    }

    if (expectedPaydayAmount === 0) {
      const recentIncomes = await prisma.transaction.findMany({
        where: {
          userId,
          type: TransactionType.INCOME,
          date: { gte: addDays(now, -60) },
        },
        select: { amount: true },
      });
      if (recentIncomes.length > 0) {
        expectedPaydayAmount = Math.round(
          recentIncomes.reduce((s, t) => s + Number(t.amount), 0) /
          Math.max(1, Math.ceil(recentIncomes.length / 2))
        );
      }
    }
  }

  const daysDiff = differenceInCalendarDays(nextPaydayDate, now);
  const daysUntilPayday = Math.max(1, daysDiff);

  // 4. Bills before next salary (Recurring Expenses)
  const recurringExpenses = await prisma.recurringTransaction.findMany({
    where: { userId, isActive: true, type: TransactionType.EXPENSE },
    include: { category: true, account: true },
    orderBy: { nextDate: 'asc' },
  });

  const endOfPayday = new Date(nextPaydayDate);
  endOfPayday.setUTCHours(23, 59, 59, 999);

  const upcomingBills = recurringExpenses
    .filter((bill) => {
      const bDate = new Date(bill.nextDate);
      return bDate <= endOfPayday;
    })
    .map((bill) => ({
      id: bill.id,
      title: bill.title,
      amount: Number(bill.amount),
      nextDate: new Date(bill.nextDate).toISOString(),
      categoryId: bill.categoryId,
      categoryName: bill.category?.name || 'General',
      categoryColor: bill.category?.color || '#3b82f6',
      accountName: bill.account?.name || undefined,
    }));

  const billsBeforeSalary = upcomingBills.reduce((sum, b) => sum + b.amount, 0);

  // 5. Budget commitments (Envelopes)
  // Use UTC month/year to match Heroku (UTC) and avoid timezone drift between localhost and production.
  const currentMonthNum = now.getUTCMonth() + 1;
  const currentYearNum = now.getUTCFullYear();
  const { startDate: startOfMonthDate, endDate: endOfMonthDate } = getMonthDateRangeUTC(currentYearNum, currentMonthNum);

  const budgetGoals = await prisma.budgetGoal.findMany({
    where: { userId, month: currentMonthNum, year: currentYearNum },
    include: { category: true },
  });

  const currentMonthExpenses = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      userId,
      type: TransactionType.EXPENSE,
      date: { gte: startOfMonthDate, lte: endOfMonthDate },
    },
    _sum: { amount: true },
  });

  const spentByCategory = new Map<string, number>();
  currentMonthExpenses.forEach((e) => {
    spentByCategory.set(e.categoryId, Number(e._sum.amount || 0));
  });

  let budgetCommitments = 0;
  const envelopeBreakdown = budgetGoals.map((goal) => {
    const limit = Number(goal.limitAmount);
    const spent = spentByCategory.get(goal.categoryId) || 0;
    const remaining = Math.max(0, limit - spent);
    budgetCommitments += remaining;
    return {
      id: goal.id,
      categoryId: goal.categoryId,
      categoryName: goal.category?.name || 'Budget',
      categoryColor: goal.category?.color || '#10b981',
      limit,
      spent,
      remaining,
    };
  });

  // 6. Savings Sinking Funds
  const savingsGoals = await prisma.savingsGoal.findMany({
    where: { userId },
  });

  let savingsCommitment = 0;
  const sinkingFunds = savingsGoals.map((goal) => {
    const target = goal.targetAmount ? Number(goal.targetAmount) : 0;
    const current = Number(goal.currentAmount);
    const neededTotal = Math.max(0, target - current);

    let monthlyAllocation = 0;
    if (neededTotal > 0) {
      if (goal.deadline) {
        const monthsRemaining = Math.max(
          1,
          Math.ceil((new Date(goal.deadline).getTime() - now.getTime()) / (30 * 24 * 60 * 60 * 1000)),
        );
        monthlyAllocation = Math.min(neededTotal, Math.round(neededTotal / monthsRemaining));
      } else {
        monthlyAllocation = Math.min(neededTotal, Math.round(target * 0.1) || Math.round(neededTotal * 0.2));
      }
    }
    savingsCommitment += monthlyAllocation;

    return {
      id: goal.id,
      name: goal.name,
      targetAmount: target,
      currentAmount: current,
      monthlyContribution: monthlyAllocation,
      deadline: goal.deadline ? goal.deadline.toISOString() : null,
    };
  });

  // 7. Safe-to-Spend Calculation
  const safeToSpend = Math.round(currentCash - billsBeforeSalary - budgetCommitments - savingsCommitment);
  const safeDailySpending = Math.max(0, Math.round(safeToSpend > 0 ? safeToSpend / daysUntilPayday : 0));

  let status: 'healthy' | 'caution' | 'critical' = 'healthy';
  if (safeToSpend <= 0) {
    status = 'critical';
  } else if ((safeDailySpending < 1000 && currency === 'LKR') || (safeDailySpending < 15 && currency === 'USD')) {
    status = 'caution';
  }

  // 8. Financial Timeline Construction
  let runningCash = currentCash;
  const timeline: Array<{
    date: string;
    title: string;
    amount: number;
    type: 'CASH_AVAILABLE' | 'BILL' | 'INCOME';
    categoryName?: string;
    categoryColor?: string;
    runningCash: number;
    accountName?: string;
  }> = [
    {
      date: now.toISOString(),
      title: 'Cash available',
      amount: currentCash,
      type: 'CASH_AVAILABLE',
      runningCash,
    },
  ];

  const sortedUpcomingBills = [...upcomingBills].sort(
    (a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime(),
  );

  for (const bill of sortedUpcomingBills) {
    runningCash -= bill.amount;
    timeline.push({
      date: bill.nextDate,
      title: bill.title,
      amount: -bill.amount,
      type: 'BILL',
      categoryName: bill.categoryName,
      categoryColor: bill.categoryColor,
      runningCash,
      accountName: bill.accountName,
    });
  }

  if (expectedPaydayAmount > 0) {
    runningCash += expectedPaydayAmount;
    timeline.push({
      date: nextPaydayDate.toISOString(),
      title: 'Salary / Income',
      amount: expectedPaydayAmount,
      type: 'INCOME',
      runningCash,
    });
  }

  return {
    currentCash,
    billsBeforeSalary,
    budgetCommitments,
    savingsCommitment,
    safeToSpend,
    safeDailySpending,
    daysUntilPayday,
    nextPaydayDate: nextPaydayDate.toISOString(),
    expectedPaydayAmount,
    currency,
    status,
    household: {
      enabled: user.householdEnabled || false,
      name: user.householdName || null,
    },
    upcomingBills,
    envelopeBreakdown,
    sinkingFunds,
    timeline,
  };
};

export const simulateSpend = async (userId: string, input: SimulateSpendInput) => {
  const safeData = await getSafeToSpend(userId);
  const remainingSafeToSpend = safeData.safeToSpend - input.amount;
  const newDailySpending = Math.max(0, Math.round(remainingSafeToSpend / safeData.daysUntilPayday));
  const canAfford = remainingSafeToSpend >= 0;

  const curr = safeData.currency;
  const formattedAmt = `${curr} ${input.amount.toLocaleString()}`;
  const formattedRem = `${curr} ${Math.abs(remainingSafeToSpend).toLocaleString()}`;
  const formattedDaily = `${curr} ${newDailySpending.toLocaleString()}/day`;

  const verdict = canAfford
    ? `Yes! You can spend ${formattedAmt}. You will still have ${formattedRem} safe to spend (${formattedDaily}) over the next ${safeData.daysUntilPayday} days until payday.`
    : `Caution: Spending ${formattedAmt} will exceed your safe-to-spend buffer by ${formattedRem} before next salary.`;

  return {
    amount: input.amount,
    canAfford,
    remainingSafeToSpend,
    newDailySpending,
    daysUntilPayday: safeData.daysUntilPayday,
    verdict,
    safeToSpendBefore: safeData.safeToSpend,
    dailySpendingBefore: safeData.safeDailySpending,
    currency: curr,
  };
};

export const emailSafeToSpendSummary = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) throw notFound('User not found');

  const safeData = await getSafeToSpend(userId);

  await sendQuickSnapshotEmail({
    to: user.email,
    userName: user.name,
    currentCash: safeData.currentCash,
    billsBeforeSalary: safeData.billsBeforeSalary,
    budgetCommitments: safeData.budgetCommitments,
    savingsCommitment: safeData.savingsCommitment,
    safeToSpend: safeData.safeToSpend,
    safeDailySpending: safeData.safeDailySpending,
    daysUntilPayday: safeData.daysUntilPayday,
    nextPaydayDate: safeData.nextPaydayDate,
    currency: safeData.currency,
  });

  return {
    success: true,
    message: `Snapshot sent to ${user.email}`,
  };
};

