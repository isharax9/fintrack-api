import { NotificationType } from '@prisma/client';
import { prisma } from '../../config/db';
import { CreateSavingsGoalInput, UpdateSavingsGoalInput, AllocateFundsInput } from './savings.schema';
import { createAuditLog } from '../audit/audit.service';
import { RequestMetadata } from '../../utils/requestContext';
import { badRequest, notFound } from '../../utils/errors';
import { createNotification } from '../notifications/notifications.service';

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
  if (!goal) throw notFound('Goal not found');

  return prisma.savingsGoal.update({
    where: { id },
    data: {
      name: data.name,
      targetAmount: data.targetAmount,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
    },
  });
};

export const allocateGoalFunds = async (userId: string, id: string, data: AllocateFundsInput, metadata: RequestMetadata) => {
  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
  if (!goal) throw notFound('Goal not found');

  return prisma.$transaction(async (tx) => {
    let bucket = await tx.savingsBucket.findUnique({ where: { userId } });
    if (!bucket) {
      bucket = await tx.savingsBucket.create({ data: { userId } });
    }

    if (Number(bucket.balance) < data.amount) {
      throw badRequest('Insufficient funds in Savings Bucket');
    }

    await tx.savingsBucket.update({
      where: { id: bucket.id },
      data: { balance: { decrement: data.amount } },
    });

    const updatedGoal = await tx.savingsGoal.update({
      where: { id },
      data: { currentAmount: { increment: data.amount } },
    });

    const targetAmount = goal.targetAmount ? Number(goal.targetAmount) : null;
    const previousAmount = Number(goal.currentAmount);
    const currentAmount = Number(updatedGoal.currentAmount);
    if (targetAmount && previousAmount < targetAmount && currentAmount >= targetAmount) {
      await createNotification({
        userId,
        type: NotificationType.SAVINGS_MILESTONE,
        title: `${updatedGoal.name} goal reached`,
        message: `You reached your ${updatedGoal.name} savings target.`,
        entityType: 'SavingsGoal',
        entityId: updatedGoal.id,
        metadata: {
          targetAmount,
          currentAmount,
        },
      }, tx);
    }

    await createAuditLog({
      userId,
      action: 'SAVINGS_GOAL_ALLOCATED',
      entityType: 'SavingsGoal',
      entityId: id,
      ...metadata,
      metadata: { amount: data.amount },
    }, tx);

    return updatedGoal;
  });
};

export const deleteGoal = async (userId: string, id: string) => {
  const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
  if (!goal) throw notFound('Goal not found');

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
