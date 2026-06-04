import { prisma } from '../../config/db';
import { CreateBudgetGoalInput, UpdateBudgetGoalInput, BudgetGoalQuery } from './budgetGoals.schema';
import { createAuditLog } from '../audit/audit.service';

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

export const createBudgetGoal = async (userId: string, data: CreateBudgetGoalInput) => {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category || category.userId !== userId) throw new Error('Invalid category');

  // Ensure no duplicate goal for the same category in the same month/year
  const existing = await prisma.budgetGoal.findFirst({
    where: {
      userId,
      categoryId: data.categoryId,
      month: data.month,
      year: data.year
    }
  });

  if (existing) throw new Error('Budget goal already exists for this category in this month');

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
      metadata: { categoryId: goal.categoryId, month: goal.month, year: goal.year, limitAmount: goal.limitAmount.toString() },
    }, tx);

    return goal;
  });
};

export const updateBudgetGoal = async (userId: string, id: string, data: UpdateBudgetGoalInput) => {
  const goal = await prisma.budgetGoal.findUnique({ where: { id } });
  if (!goal || goal.userId !== userId) throw new Error('Budget goal not found');

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
      metadata: { previousLimitAmount: goal.limitAmount.toString(), limitAmount: updated.limitAmount.toString() },
    }, tx);

    return updated;
  });
};

export const deleteBudgetGoal = async (userId: string, id: string) => {
  const goal = await prisma.budgetGoal.findUnique({ where: { id } });
  if (!goal || goal.userId !== userId) throw new Error('Budget goal not found');

  await prisma.$transaction(async (tx) => {
    await tx.budgetGoal.delete({ where: { id } });
    await createAuditLog({
      userId,
      action: 'BUDGET_GOAL_DELETED',
      entityType: 'BudgetGoal',
      entityId: id,
      metadata: { categoryId: goal.categoryId, month: goal.month, year: goal.year, limitAmount: goal.limitAmount.toString() },
    }, tx);
  });
};
