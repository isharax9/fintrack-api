import { prisma } from '../../config/db';
import { ReportQuery } from './reports.schema';
import { TransactionType } from '@prisma/client';

export const getSummary = async (userId: string, query: ReportQuery) => {
  const startDate = new Date(query.year, query.month - 1, 1);
  const endDate = new Date(query.year, query.month, 0, 23, 59, 59, 999);

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
  const startDate = new Date(query.year, query.month - 1, 1);
  const endDate = new Date(query.year, query.month, 0, 23, 59, 59, 999);

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
  const startDate = new Date(query.year, query.month - 1, 1);
  const endDate = new Date(query.year, query.month, 0, 23, 59, 59, 999);

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
