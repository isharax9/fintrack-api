import { NotificationType, Prisma, RecurringExecutionTrigger, RecurringTransaction } from '@prisma/client';
import { prisma } from '../../config/db';
import { badRequest, notFound } from '../../utils/errors';
import { RequestMetadata } from '../../utils/requestContext';
import { createAuditLog } from '../audit/audit.service';
import { createNotification } from '../notifications/notifications.service';
import { CreateRecurringInput, RecurringExecutionQuery, RecurringQuery, UpdateRecurringInput } from './recurring.schema';
import { addDays, addMonths, addWeeks, addYears } from 'date-fns';

const assertOwnedAccount = async (userId: string, accountId: string) => {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw badRequest('Invalid account');
};

const assertOwnedCategory = async (userId: string, categoryId: string) => {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw badRequest('Invalid category');
};

const createDueSoonNotification = async (
  client: Prisma.TransactionClient,
  userId: string,
  recurring: { id: string; title: string; amount: unknown; nextDate: Date; isActive: boolean },
) => {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (!recurring.isActive || recurring.nextDate > sevenDaysFromNow) return;

  await createNotification({
    userId,
    type: NotificationType.BILL_REMINDER,
    title: `${recurring.title} is due soon`,
    message: `${recurring.title} is scheduled for ${recurring.nextDate.toISOString().slice(0, 10)}.`,
    entityType: 'RecurringTransaction',
    entityId: recurring.id,
    metadata: {
      amount: Number(recurring.amount),
      nextDate: recurring.nextDate.toISOString(),
    },
  }, client);
};

const advanceNextDate = (date: Date, frequency: RecurringTransaction['frequency']) => {
  if (frequency === 'DAILY') return addDays(date, 1);
  if (frequency === 'WEEKLY') return addWeeks(date, 1);
  if (frequency === 'BIWEEKLY') return addWeeks(date, 2);
  if (frequency === 'MONTHLY') return addMonths(date, 1);
  return addYears(date, 1);
};

type RecurringRecord = Prisma.RecurringTransactionGetPayload<{
  include: { account: true; category: true };
}>;

const recordRecurringFailure = async (
  recurring: Pick<RecurringTransaction, 'id' | 'userId' | 'categoryId' | 'nextDate'>,
  trigger: RecurringExecutionTrigger,
  scheduledFor: Date,
  error: unknown,
) => {
  await prisma.recurringExecution.create({
    data: {
      userId: recurring.userId,
      recurringId: recurring.id,
      categoryId: recurring.categoryId,
      scheduledFor,
      status: 'FAILED',
      trigger,
      message: error instanceof Error ? error.message : 'Recurring execution failed',
    },
  });
};

const executeRecurringRecord = async (
  recurring: RecurringRecord,
  trigger: RecurringExecutionTrigger,
  metadata: RequestMetadata,
) => {
  const now = new Date();
  const scheduledFor = trigger === 'RUN_NOW' ? now : recurring.nextDate;
  const shouldAdvanceSchedule = trigger === 'AUTO' || recurring.nextDate <= now;

  try {
    return await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          userId: recurring.userId,
          accountId: recurring.accountId,
          categoryId: recurring.categoryId,
          title: recurring.title,
          amount: recurring.amount,
          type: recurring.type,
          notes: recurring.notes,
          date: now,
        },
      });

      const incrementValue = recurring.type === 'INCOME' ? recurring.amount : new Prisma.Decimal(recurring.amount).negated();
      await tx.account.update({
        where: { id: recurring.accountId },
        data: { balance: { increment: incrementValue } },
      });

      const nextDate = shouldAdvanceSchedule ? advanceNextDate(recurring.nextDate, recurring.frequency) : recurring.nextDate;
      const updated = await tx.recurringTransaction.update({
        where: { id: recurring.id },
        data: { nextDate },
        include: { account: true, category: true },
      });

      await tx.recurringExecution.create({
        data: {
          userId: recurring.userId,
          recurringId: recurring.id,
          transactionId: transaction.id,
          categoryId: recurring.categoryId,
          scheduledFor,
          status: 'SUCCESS',
          trigger,
          message: trigger === 'RUN_NOW' ? 'Manual run completed' : 'Automatic run completed',
        },
      });

      await createAuditLog({
        userId: recurring.userId,
        action: trigger === 'RUN_NOW' ? 'RECURRING_RUN_NOW' : 'RECURRING_EXECUTED',
        entityType: 'RecurringTransaction',
        entityId: recurring.id,
        ...metadata,
        metadata: {
          transactionId: transaction.id,
          accountId: recurring.accountId,
          categoryId: recurring.categoryId,
          type: recurring.type,
          frequency: recurring.frequency,
          amount: recurring.amount.toString(),
          previousNextDate: recurring.nextDate.toISOString(),
          nextDate: updated.nextDate.toISOString(),
        },
      }, tx);

      return updated;
    });
  } catch (error) {
    await recordRecurringFailure(recurring, trigger, scheduledFor, error);
    throw error;
  }
};

export const listRecurring = async (userId: string, query: RecurringQuery) => {
  const where: Prisma.RecurringTransactionWhereInput = { userId };

  if (query.type) where.type = query.type;
  if (query.accountId) where.accountId = query.accountId;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.isActive !== undefined) where.isActive = query.isActive;

  const skip = (query.page - 1) * query.limit;

  const [data, total] = await Promise.all([
    prisma.recurringTransaction.findMany({
      where,
      include: { account: true, category: true },
      orderBy: { nextDate: 'asc' },
      skip,
      take: query.limit,
    }),
    prisma.recurringTransaction.count({ where }),
  ]);

  return {
    data,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const createRecurring = async (userId: string, data: CreateRecurringInput, metadata: RequestMetadata) => {
  await assertOwnedAccount(userId, data.accountId);
  await assertOwnedCategory(userId, data.categoryId);

  return prisma.$transaction(async (tx) => {
    const recurring = await tx.recurringTransaction.create({
      data: {
        userId,
        accountId: data.accountId,
        categoryId: data.categoryId,
        title: data.title,
        amount: data.amount,
        type: data.type,
        frequency: data.frequency,
        nextDate: new Date(data.nextDate),
        notes: data.notes,
        isActive: data.isActive,
      },
      include: { account: true, category: true },
    });

    await createAuditLog({
      userId,
      action: 'RECURRING_CREATED',
      entityType: 'RecurringTransaction',
      entityId: recurring.id,
      ...metadata,
      metadata: {
        accountId: recurring.accountId,
        categoryId: recurring.categoryId,
        type: recurring.type,
        frequency: recurring.frequency,
        amount: recurring.amount.toString(),
        nextDate: recurring.nextDate.toISOString(),
      },
    }, tx);

    await createDueSoonNotification(tx, userId, recurring);

    return recurring;
  });
};

export const getRecurring = async (userId: string, id: string) => {
  const recurring = await prisma.recurringTransaction.findFirst({
    where: { id, userId },
    include: { account: true, category: true },
  });

  if (!recurring) throw notFound('Recurring transaction not found');
  return recurring;
};

export const updateRecurring = async (userId: string, id: string, data: UpdateRecurringInput, metadata: RequestMetadata) => {
  const original = await getRecurring(userId, id);

  if (data.accountId) await assertOwnedAccount(userId, data.accountId);
  if (data.categoryId) await assertOwnedCategory(userId, data.categoryId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.recurringTransaction.update({
      where: { id },
      data: {
        accountId: data.accountId,
        categoryId: data.categoryId,
        title: data.title,
        amount: data.amount,
        type: data.type,
        frequency: data.frequency,
        nextDate: data.nextDate ? new Date(data.nextDate) : undefined,
        notes: data.notes,
        isActive: data.isActive,
      },
      include: { account: true, category: true },
    });

    await createAuditLog({
      userId,
      action: 'RECURRING_UPDATED',
      entityType: 'RecurringTransaction',
      entityId: updated.id,
      ...metadata,
      metadata: {
        previousAccountId: original.accountId,
        accountId: updated.accountId,
        previousCategoryId: original.categoryId,
        categoryId: updated.categoryId,
        previousType: original.type,
        type: updated.type,
        previousFrequency: original.frequency,
        frequency: updated.frequency,
        previousAmount: original.amount.toString(),
        amount: updated.amount.toString(),
        previousNextDate: original.nextDate.toISOString(),
        nextDate: updated.nextDate.toISOString(),
        previousIsActive: original.isActive,
        isActive: updated.isActive,
      },
    }, tx);

    await createDueSoonNotification(tx, userId, updated);

    return updated;
  });
};

export const deleteRecurring = async (userId: string, id: string, metadata: RequestMetadata) => {
  const recurring = await getRecurring(userId, id);
  await prisma.$transaction(async (tx) => {
    await tx.recurringTransaction.delete({ where: { id } });
    await createAuditLog({
      userId,
      action: 'RECURRING_DELETED',
      entityType: 'RecurringTransaction',
      entityId: id,
      ...metadata,
      metadata: {
        accountId: recurring.accountId,
        categoryId: recurring.categoryId,
        type: recurring.type,
        frequency: recurring.frequency,
        amount: recurring.amount.toString(),
        nextDate: recurring.nextDate.toISOString(),
      },
    }, tx);
  });
};

export const runRecurringNow = async (userId: string, id: string, metadata: RequestMetadata) => {
  const recurring = await getRecurring(userId, id);
  return executeRecurringRecord(recurring, 'RUN_NOW', metadata);
};

export const skipNextRecurring = async (userId: string, id: string, metadata: RequestMetadata) => {
  const recurring = await getRecurring(userId, id);
  const nextDate = advanceNextDate(recurring.nextDate, recurring.frequency);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.recurringTransaction.update({
      where: { id },
      data: { nextDate },
      include: { account: true, category: true },
    });

    await tx.recurringExecution.create({
      data: {
        userId,
        recurringId: recurring.id,
        categoryId: recurring.categoryId,
        scheduledFor: recurring.nextDate,
        status: 'SKIPPED',
        trigger: 'SKIP',
        message: 'Skipped by user',
      },
    });

    await createAuditLog({
      userId,
      action: 'RECURRING_SKIPPED',
      entityType: 'RecurringTransaction',
      entityId: recurring.id,
      ...metadata,
      metadata: {
        previousNextDate: recurring.nextDate.toISOString(),
        nextDate: updated.nextDate.toISOString(),
      },
    }, tx);

    return updated;
  });
};

export const listRecurringExecutions = async (userId: string, id: string, query: RecurringExecutionQuery) => {
  await getRecurring(userId, id);
  const skip = (query.page - 1) * query.limit;

  const [data, total] = await Promise.all([
    prisma.recurringExecution.findMany({
      where: { userId, recurringId: id },
      include: { transaction: true, category: true },
      orderBy: { executedAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.recurringExecution.count({ where: { userId, recurringId: id } }),
  ]);

  return {
    data,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const processDueRecurringTransactions = async (now = new Date()) => {
  const recurrings = await prisma.recurringTransaction.findMany({
    where: {
      isActive: true,
      nextDate: { lte: now },
    },
    include: { account: true, category: true },
  });

  for (const recurring of recurrings) {
    try {
      await executeRecurringRecord(recurring, 'AUTO', { requestId: 'cron:recurring' });
    } catch {
      // Failure details are recorded by executeRecurringRecord.
    }
  }

  return recurrings.length;
};
