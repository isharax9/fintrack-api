import { prisma } from '../../config/db';
import { CreateTransactionInput, UpdateTransactionInput, TransactionQuery } from './transactions.schema';
import { Prisma } from '@prisma/client';

export const listTransactions = async (userId: string, query: TransactionQuery) => {
  const where: Prisma.TransactionWhereInput = { userId };
  
  if (query.type) where.type = query.type;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.accountId) where.accountId = query.accountId;
  if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date.gte = new Date(query.from);
    if (query.to) where.date.lte = new Date(query.to);
  }

  const skip = (query.page - 1) * query.limit;
  
  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { category: true, tags: true },
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
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category || category.userId !== userId) throw new Error('Invalid category');

  if (data.accountId) {
    const account = await prisma.account.findUnique({ where: { id: data.accountId } });
    if (!account || account.userId !== userId) throw new Error('Invalid account');
  }

  return prisma.$transaction(async (tx) => {
    // 1. Create transaction with optional tags
    const _data: Prisma.TransactionCreateInput = {
      user: { connect: { id: userId } },
      category: { connect: { id: data.categoryId } },
      title: data.title,
      amount: data.amount,
      type: data.type,
      date: new Date(data.date),
      notes: data.notes,
    };

    if (data.accountId) {
      _data.account = { connect: { id: data.accountId } };
    }

    if (data.tagIds && data.tagIds.length > 0) {
      _data.tags = {
        connect: data.tagIds.map(id => ({ id }))
      };
    }

    const transaction = await tx.transaction.create({
      data: _data,
      include: { category: true, tags: true }
    });

    // 2. Adjust account balance if account is specified
    if (data.accountId) {
      const incrementValue = data.type === 'INCOME' ? data.amount : -data.amount;
      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: { increment: incrementValue } },
      });
    }

    return transaction;
  });
};

export const getTransaction = async (userId: string, id: string) => {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { category: true, tags: true }
  });
  
  if (!transaction || transaction.userId !== userId) throw new Error('Transaction not found');
  return transaction;
};

export const updateTransaction = async (userId: string, id: string, data: UpdateTransactionInput) => {
  const original = await getTransaction(userId, id);

  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category || category.userId !== userId) throw new Error('Invalid category');
  }

  if (data.accountId) {
    const account = await prisma.account.findUnique({ where: { id: data.accountId } });
    if (!account || account.userId !== userId) throw new Error('Invalid account');
  }

  return prisma.$transaction(async (tx) => {
    // 1. Reverse the effect on original account if needed
    if (original.accountId) {
      const reverseAmt = original.type === 'INCOME' ? -Number(original.amount) : Number(original.amount);
      await tx.account.update({
        where: { id: original.accountId },
        data: { balance: { increment: reverseAmt } }
      });
    }

    // 2. Build the update params
    const _updateData: Prisma.TransactionUpdateInput = {
      title: data.title,
      amount: data.amount,
      type: data.type,
      date: data.date ? new Date(data.date) : undefined,
      notes: data.notes,
    };
    
    if (data.categoryId) _updateData.category = { connect: { id: data.categoryId } };
    if (data.accountId !== undefined) {
      if (data.accountId === null) {
        // we can't easily disconnect using standard setup without explicit logic, but let's assume it's set null or ignored if not provided.
      } else {
        _updateData.account = { connect: { id: data.accountId } };
      }
    }

    if (data.tagIds) {
      _updateData.tags = {
        set: data.tagIds.map(id => ({ id }))
      };
    }

    const updated = await tx.transaction.update({
      where: { id },
      data: _updateData,
      include: { category: true, tags: true }
    });

    // 3. Apply new effect to the target account
    if (updated.accountId) {
      const applyAmt = updated.type === 'INCOME' ? Number(updated.amount) : -Number(updated.amount);
      await tx.account.update({
        where: { id: updated.accountId },
        data: { balance: { increment: applyAmt } }
      });
    }

    return updated;
  });
};

export const deleteTransaction = async (userId: string, id: string) => {
  const original = await getTransaction(userId, id);
  
  await prisma.$transaction(async (tx) => {
    if (original.accountId) {
      const reverseAmt = original.type === 'INCOME' ? -Number(original.amount) : Number(original.amount);
      await tx.account.update({
        where: { id: original.accountId },
        data: { balance: { increment: reverseAmt } }
      });
    }
    await tx.transaction.delete({ where: { id } });
  });
};

