import { prisma } from '../../config/db';
import { CreateBudgetGoalInput, UpdateBudgetGoalInput, BudgetGoalQuery } from './budgetGoals.schema';

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

  return prisma.budgetGoal.create({
    data: {
      ...data,
      userId
    },
    include: { category: true }
  });
};

export const updateBudgetGoal = async (userId: string, id: string, data: UpdateBudgetGoalInput) => {
  const goal = await prisma.budgetGoal.findUnique({ where: { id } });
  if (!goal || goal.userId !== userId) throw new Error('Budget goal not found');

  return prisma.budgetGoal.update({
    where: { id },
    data,
    include: { category: true }
  });
};

export const deleteBudgetGoal = async (userId: string, id: string) => {
  const goal = await prisma.budgetGoal.findUnique({ where: { id } });
  if (!goal || goal.userId !== userId) throw new Error('Budget goal not found');

  await prisma.budgetGoal.delete({ where: { id } });
};
