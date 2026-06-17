import { NotificationType, Prisma, TransactionType } from '@prisma/client';
import { prisma } from '../../config/db';
import { CreateBudgetGoalInput, UpdateBudgetGoalInput, BudgetGoalQuery } from './budgetGoals.schema';
import { createAuditLog } from '../audit/audit.service';
import { RequestMetadata } from '../../utils/requestContext';
import { badRequest, conflict, notFound } from '../../utils/errors';
import { createNotification } from '../notifications/notifications.service';

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

  return prisma.$transaction(async (tx) => {
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
