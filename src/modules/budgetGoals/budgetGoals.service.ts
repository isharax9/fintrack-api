import { NotificationType, Prisma, TransactionType } from '@prisma/client';
import { prisma } from '../../config/db';
import { CreateBudgetGoalInput, UpdateBudgetGoalInput, BudgetGoalQuery, TransferEnvelopeInput, FillEnvelopesInput } from './budgetGoals.schema';
import { createAuditLog } from '../audit/audit.service';
import { RequestMetadata } from '../../utils/requestContext';
import { badRequest, conflict, notFound } from '../../utils/errors';
import { createNotification } from '../notifications/notifications.service';
import { getMonthDateRangeUTC } from '../../utils/date';


const createBudgetPressureNotification = async (
  client: Prisma.TransactionClient,
  userId: string,
  goal: { id: string; categoryId: string; month: number; year: number; limitAmount: unknown; category?: { name: string } | null },
) => {
  const monthStart = new Date(Date.UTC(goal.year, goal.month - 1, 1));
  const monthEnd = new Date(Date.UTC(goal.year, goal.month, 0, 23, 59, 59, 999));
  const spent = await client.transaction.aggregate({
    where: {
      userId,
      categoryId: goal.categoryId,
      type: TransactionType.EXPENSE,
      date: { gte: monthStart, lte: monthEnd },
    },
    _sum: { amount: true },
  });
  const limit = Number(goal.limitAmount);
  const spentAmount = Number(spent._sum.amount || 0);
  if (limit <= 0 || spentAmount < limit * 0.8) return;

  const percent = Math.round((spentAmount / limit) * 100);
  const categoryName = goal.category?.name || 'Budget';
  await createNotification({
    userId,
    type: NotificationType.BUDGET_ALERT,
    title: percent >= 100 ? `${categoryName} is over budget` : `${categoryName} budget is under pressure`,
    message: `${categoryName} is at ${percent}% of its monthly budget.`,
    entityType: 'BudgetGoal',
    entityId: goal.id,
    metadata: {
      categoryId: goal.categoryId,
      month: goal.month,
      year: goal.year,
      spentAmount,
      limitAmount: limit,
      percent,
    },
  }, client);
};

export const listBudgetGoals = async (userId: string, query: BudgetGoalQuery) => {
  return prisma.budgetGoal.findMany({
    where: { 
      userId,
      month: query.month,
      year: query.year
    },
    include: { category: true }
  });
};

export const createBudgetGoal = async (userId: string, data: CreateBudgetGoalInput, metadata: RequestMetadata) => {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category || category.userId !== userId) throw badRequest('Invalid category');

  // Ensure no duplicate goal for the same category in the same month/year
  const existing = await prisma.budgetGoal.findFirst({
    where: {
      userId,
      categoryId: data.categoryId,
      month: data.month,
      year: data.year
    }
  });

  if (existing) throw conflict('Budget goal already exists for this category in this month');

  try {
    return await prisma.$transaction(async (tx) => {
      const goal = await tx.budgetGoal.create({
        data: {
          ...data,
          userId
        },
        include: { category: true }
      });

      await createAuditLog({
        userId,
        action: 'BUDGET_GOAL_CREATED',
        entityType: 'BudgetGoal',
        entityId: goal.id,
        ...metadata,
        metadata: { categoryId: goal.categoryId, month: goal.month, year: goal.year, limitAmount: goal.limitAmount.toString() },
      }, tx);

      await createBudgetPressureNotification(tx, userId, goal);

      return goal;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw conflict('Budget goal already exists for this category in this month');
    }
    throw error;
  }
};

export const updateBudgetGoal = async (userId: string, id: string, data: UpdateBudgetGoalInput, metadata: RequestMetadata) => {
  const goal = await prisma.budgetGoal.findUnique({ where: { id } });
  if (!goal || goal.userId !== userId) throw notFound('Budget goal not found');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.budgetGoal.update({
      where: { id },
      data,
      include: { category: true }
    });

    await createAuditLog({
      userId,
      action: 'BUDGET_GOAL_UPDATED',
      entityType: 'BudgetGoal',
      entityId: updated.id,
      ...metadata,
      metadata: { previousLimitAmount: goal.limitAmount.toString(), limitAmount: updated.limitAmount.toString() },
    }, tx);

    await createBudgetPressureNotification(tx, userId, updated);

    return updated;
  });
};

export const deleteBudgetGoal = async (userId: string, id: string, metadata: RequestMetadata) => {
  const goal = await prisma.budgetGoal.findUnique({ where: { id } });
  if (!goal || goal.userId !== userId) throw notFound('Budget goal not found');

  await prisma.$transaction(async (tx) => {
    await tx.budgetGoal.delete({ where: { id } });
    await createAuditLog({
      userId,
      action: 'BUDGET_GOAL_DELETED',
      entityType: 'BudgetGoal',
      entityId: id,
      ...metadata,
      metadata: { categoryId: goal.categoryId, month: goal.month, year: goal.year, limitAmount: goal.limitAmount.toString() },
    }, tx);
  });
};

export const getEnvelopes = async (userId: string, query: BudgetGoalQuery) => {
  const { month, year } = query;
  const { startDate, endDate } = getMonthDateRangeUTC(year, month);

  const [categories, budgetGoals, expenses, transfers] = await Promise.all([
    prisma.category.findMany({ where: { userId } }),
    prisma.budgetGoal.findMany({
      where: { userId, month, year },
      include: { category: true },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: TransactionType.EXPENSE,
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    }),
    prisma.envelopeTransfer.findMany({
      where: { userId, month, year },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const spentMap = new Map<string, number>();
  expenses.forEach((e) => {
    spentMap.set(e.categoryId, Number(e._sum.amount || 0));
  });

  const goalsMap = new Map(budgetGoals.map((g) => [g.categoryId, g]));

  const envelopes = categories.map((cat) => {
    const goal = goalsMap.get(cat.id);
    const limit = goal ? Number(goal.limitAmount) : 0;
    const spent = spentMap.get(cat.id) || 0;
    const remaining = limit - spent;
    const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;

    let status: 'empty' | 'healthy' | 'warning' | 'overspent' = 'healthy';
    if (limit === 0) status = 'empty';
    else if (percent > 100) status = 'overspent';
    else if (percent >= 80) status = 'warning';

    return {
      goalId: goal?.id || null,
      categoryId: cat.id,
      categoryName: cat.name,
      color: cat.color,
      icon: cat.icon,
      limit,
      spent,
      remaining,
      percent,
      status,
    };
  });

  const totalBudgeted = envelopes.reduce((s, e) => s + e.limit, 0);
  const totalSpent = envelopes.reduce((s, e) => s + e.spent, 0);
  const totalRemaining = envelopes.reduce((s, e) => s + Math.max(0, e.remaining), 0);

  return {
    month,
    year,
    totalBudgeted,
    totalSpent,
    totalRemaining,
    envelopes,
    recentTransfers: transfers.map((t) => ({
      id: t.id,
      fromCategoryId: t.fromCategoryId,
      toCategoryId: t.toCategoryId,
      amount: Number(t.amount),
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    })),
  };
};

export const transferEnvelopeFunds = async (
  userId: string,
  input: TransferEnvelopeInput,
  metadata: RequestMetadata,
) => {
  if (input.fromCategoryId === input.toCategoryId) {
    throw badRequest('Source and destination envelopes must be different');
  }

  const { fromCategoryId, toCategoryId, amount, month, year, note } = input;

  const [fromCategory, toCategory] = await Promise.all([
    prisma.category.findFirst({ where: { id: fromCategoryId, userId } }),
    prisma.category.findFirst({ where: { id: toCategoryId, userId } }),
  ]);
  if (!fromCategory || !toCategory) throw notFound('Category not found');

  return prisma.$transaction(async (tx) => {
    const fromGoal = await tx.budgetGoal.findFirst({
      where: { userId, categoryId: fromCategoryId, month, year },
    });
    if (!fromGoal) throw badRequest(`No envelope found for ${fromCategory.name} in this cycle`);

    const currentLimit = Number(fromGoal.limitAmount);
    if (currentLimit < amount) {
      throw badRequest(`Insufficient funds in ${fromCategory.name} envelope (current budget: ${currentLimit})`);
    }

    const toGoal = await tx.budgetGoal.findFirst({
      where: { userId, categoryId: toCategoryId, month, year },
    });

    const updatedFrom = await tx.budgetGoal.update({
      where: { id: fromGoal.id },
      data: { limitAmount: { decrement: amount } },
      include: { category: true },
    });

    let updatedTo;
    if (toGoal) {
      updatedTo = await tx.budgetGoal.update({
        where: { id: toGoal.id },
        data: { limitAmount: { increment: amount } },
        include: { category: true },
      });
    } else {
      updatedTo = await tx.budgetGoal.create({
        data: {
          userId,
          categoryId: toCategoryId,
          month,
          year,
          limitAmount: amount,
        },
        include: { category: true },
      });
    }

    const transfer = await tx.envelopeTransfer.create({
      data: {
        userId,
        fromCategoryId,
        toCategoryId,
        amount,
        month,
        year,
        note,
      },
    });

    await createAuditLog({
      userId,
      action: 'ENVELOPE_TRANSFER_EXECUTED',
      entityType: 'EnvelopeTransfer',
      entityId: transfer.id,
      ...metadata,
      metadata: {
        fromCategoryId,
        toCategoryId,
        amount: amount.toString(),
        month,
        year,
        note,
      },
    }, tx);

    return {
      transfer,
      fromEnvelope: updatedFrom,
      toEnvelope: updatedTo,
    };
  });
};

export const fillEnvelopes = async (
  userId: string,
  input: FillEnvelopesInput,
  metadata: RequestMetadata,
) => {
  const { month, year, mode, fills } = input;

  return prisma.$transaction(async (tx) => {
    const results = [];
    for (const item of fills) {
      const existing = await tx.budgetGoal.findFirst({
        where: { userId, categoryId: item.categoryId, month, year },
      });

      if (existing) {
        const newLimit = mode === 'add'
          ? Number(existing.limitAmount) + item.amount
          : item.amount;
        const updated = await tx.budgetGoal.update({
          where: { id: existing.id },
          data: { limitAmount: newLimit },
          include: { category: true },
        });
        results.push(updated);
      } else if (item.amount > 0) {
        const created = await tx.budgetGoal.create({
          data: {
            userId,
            categoryId: item.categoryId,
            month,
            year,
            limitAmount: item.amount,
          },
          include: { category: true },
        });
        results.push(created);
      }
    }

    await createAuditLog({
      userId,
      action: 'ENVELOPES_FILLED',
      entityType: 'BudgetGoal',
      ...metadata,
      metadata: {
        month,
        year,
        mode,
        count: results.length,
      },
    }, tx);

    return results;
  });
};

