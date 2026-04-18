import { prisma } from '../../config/db';
import { CreateTransactionInput, UpdateTransactionInput, TransactionQuery } from './transactions.schema';
import { Prisma } from '@prisma/client';

export const listTransactions = async (userId: string, query: TransactionQuery) => {
  const where: Prisma.TransactionWhereInput = { userId };
  
  if (query.type) where.type = query.type;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date.gte = new Date(query.from);
    if (query.to) where.date.lte = new Date(query.to);
  }

  const skip = (query.page - 1) * query.limit;
  
  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true },
      orderBy: { date: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.transaction.count({ where })
  ]);

  return {
    data,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit)
    }
  };
};

export const createTransaction = async (userId: string, data: CreateTransactionInput) => {
  // Ensure category belongs to user
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category || category.userId !== userId) throw new Error('Invalid category');

  return prisma.transaction.create({
    data: {
      ...data,
      userId,
      date: new Date(data.date),
    },
    include: { category: true }
  });
};

export const getTransaction = async (userId: string, id: string) => {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { category: true }
  });
  
  if (!transaction || transaction.userId !== userId) throw new Error('Transaction not found');
  return transaction;
};

export const updateTransaction = async (userId: string, id: string, data: UpdateTransactionInput) => {
  await getTransaction(userId, id); // Verify ownership

  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category || category.userId !== userId) throw new Error('Invalid category');
  }

  return prisma.transaction.update({
    where: { id },
    data: {
      ...data,
      date: data.date ? new Date(data.date) : undefined
    },
    include: { category: true }
  });
};

export const deleteTransaction = async (userId: string, id: string) => {
  await getTransaction(userId, id); // Verify ownership
  await prisma.transaction.delete({ where: { id } });
};
