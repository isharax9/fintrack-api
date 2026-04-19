import { prisma } from '../../config/db';
import { CreateSavingsGoalInput, UpdateSavingsGoalInput, AllocateFundsInput } from './savings.schema';

export const getBucket = async (userId: string) => {
  let bucket = await prisma.savingsBucket.findUnique({ where: { userId } });
  if (!bucket) {
    bucket = await prisma.savingsBucket.create({ data: { userId } });
  }
  return bucket;
};

export const listGoals = async (userId: string) => {
  return prisma.savingsGoal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
};

export const createGoal = async (userId: string, data: CreateSavingsGoalInput) => {
  return prisma.savingsGoal.create({
    data: {
      userId,
      name: data.name,
      targetAmount: data.targetAmount,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
    },
  });
};

export const updateGoal = async (userId: string, id: string, data: UpdateSavingsGoalInput) => {
  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
  if (!goal) throw new Error('Goal not found');

  return prisma.savingsGoal.update({
    where: { id },
    data: {
      name: data.name,
      targetAmount: data.targetAmount,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
    },
  });
};

export const allocateGoalFunds = async (userId: string, id: string, data: AllocateFundsInput) => {
  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
  if (!goal) throw new Error('Goal not found');

  return prisma.$transaction(async (tx) => {
    let bucket = await tx.savingsBucket.findUnique({ where: { userId } });
    if (!bucket) {
      bucket = await tx.savingsBucket.create({ data: { userId } });
    }

    if (Number(bucket.balance) < data.amount) {
      throw new Error('Insufficient funds in Savings Bucket');
    }

    await tx.savingsBucket.update({
      where: { id: bucket.id },
      data: { balance: { decrement: data.amount } },
    });

    return tx.savingsGoal.update({
      where: { id },
      data: { currentAmount: { increment: data.amount } },
    });
  });
};

export const deleteGoal = async (userId: string, id: string) => {
  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
  if (!goal) throw new Error('Goal not found');

  return prisma.$transaction(async (tx) => {
    // Return funds back to bucket
    if (Number(goal.currentAmount) > 0) {
      const bucket = await tx.savingsBucket.findUnique({ where: { userId } });
      if (bucket) {
        await tx.savingsBucket.update({
          where: { id: bucket.id },
          data: { balance: { increment: goal.currentAmount } },
        });
      }
    }

    await tx.savingsGoal.delete({ where: { id } });
  });
};
