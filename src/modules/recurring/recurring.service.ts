import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { badRequest, notFound } from '../../utils/errors';
import { RequestMetadata } from '../../utils/requestContext';
import { createAuditLog } from '../audit/audit.service';
import { CreateRecurringInput, RecurringQuery, UpdateRecurringInput } from './recurring.schema';

const assertOwnedAccount = async (userId: string, accountId: string) => {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw badRequest('Invalid account');
};

const assertOwnedCategory = async (userId: string, categoryId: string) => {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw badRequest('Invalid category');
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
