import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { CreateRecurringInput, RecurringQuery, UpdateRecurringInput } from './recurring.schema';

const assertOwnedAccount = async (userId: string, accountId: string) => {
  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) throw new Error('Invalid account');
};

const assertOwnedCategory = async (userId: string, categoryId: string) => {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw new Error('Invalid category');
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

export const createRecurring = async (userId: string, data: CreateRecurringInput) => {
  await assertOwnedAccount(userId, data.accountId);
  await assertOwnedCategory(userId, data.categoryId);

  return prisma.recurringTransaction.create({
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
};

export const getRecurring = async (userId: string, id: string) => {
  const recurring = await prisma.recurringTransaction.findFirst({
    where: { id, userId },
    include: { account: true, category: true },
  });

  if (!recurring) throw new Error('Recurring transaction not found');
  return recurring;
};

export const updateRecurring = async (userId: string, id: string, data: UpdateRecurringInput) => {
  await getRecurring(userId, id);

  if (data.accountId) await assertOwnedAccount(userId, data.accountId);
  if (data.categoryId) await assertOwnedCategory(userId, data.categoryId);

  return prisma.recurringTransaction.update({
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
};

export const deleteRecurring = async (userId: string, id: string) => {
  await getRecurring(userId, id);
  await prisma.recurringTransaction.delete({ where: { id } });
};
