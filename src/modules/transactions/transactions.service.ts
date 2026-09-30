import { prisma } from '../../config/db';
import { CreateTransactionInput, UpdateTransactionInput, TransactionQuery } from './transactions.schema';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '../audit/audit.service';
import { RequestMetadata } from '../../utils/requestContext';
import { badRequest, notFound } from '../../utils/errors';
import { addDays } from 'date-fns';


export const buildTransactionWhere = async (userId: string, query: TransactionQuery) => {
  const where: Prisma.TransactionWhereInput = { userId };

  if (query.type) where.type = query.type;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.accountId) where.accountId = query.accountId;
  if (query.tagId) {
    const tag = await prisma.tag.findFirst({
      where: { id: query.tagId, userId },
      select: { id: true },
    });
    if (!tag) throw badRequest('Invalid tag');
    where.tags = { some: { id: query.tagId, userId } };
  }
  if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date.gte = new Date(query.from);
    if (query.to) where.date.lte = new Date(query.to);
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { notes: { contains: query.search, mode: 'insensitive' } },
      { category: { name: { contains: query.search, mode: 'insensitive' } } },
      { account: { name: { contains: query.search, mode: 'insensitive' } } },
      { tags: { some: { name: { contains: query.search, mode: 'insensitive' }, userId } } },
    ];
  }

  return where;
};

export const listTransactions = async (userId: string, query: TransactionQuery) => {
  const where = await buildTransactionWhere(userId, query);
  const skip = (query.page - 1) * query.limit;
  
  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { account: true, category: true, tags: true },
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

export const createTransaction = async (userId: string, data: CreateTransactionInput, metadata: RequestMetadata) => {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category || category.userId !== userId) throw badRequest('Invalid category');

  if (data.accountId) {
    const account = await prisma.account.findUnique({ where: { id: data.accountId } });
    if (!account || account.userId !== userId) throw badRequest('Invalid account');
  }

  if (data.tagIds && data.tagIds.length > 0) {
    const tags = await prisma.tag.findMany({
      where: { id: { in: data.tagIds }, userId },
      select: { id: true },
    });
    if (tags.length !== new Set(data.tagIds).size) throw badRequest('Invalid tag');
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

    await createAuditLog({
      userId,
      action: 'TRANSACTION_CREATED',
      entityType: 'Transaction',
      entityId: transaction.id,
      ...metadata,
      metadata: {
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        type: transaction.type,
        amount: transaction.amount.toString(),
      },
    }, tx);

    return transaction;
  });
};

export const getTransaction = async (userId: string, id: string) => {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: { category: true, tags: true }
  });
  
  if (!transaction || transaction.userId !== userId) throw notFound('Transaction not found');
  return transaction;
};

export const updateTransaction = async (userId: string, id: string, data: UpdateTransactionInput, metadata: RequestMetadata) => {
  const original = await getTransaction(userId, id);

  if (data.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category || category.userId !== userId) throw badRequest('Invalid category');
  }

  if (data.accountId) {
    const account = await prisma.account.findUnique({ where: { id: data.accountId } });
    if (!account || account.userId !== userId) throw badRequest('Invalid account');
  }

  if (data.tagIds && data.tagIds.length > 0) {
    const tags = await prisma.tag.findMany({
      where: { id: { in: data.tagIds }, userId },
      select: { id: true },
    });
    if (tags.length !== new Set(data.tagIds).size) throw badRequest('Invalid tag');
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
        _updateData.account = { disconnect: true };
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

    await createAuditLog({
      userId,
      action: 'TRANSACTION_UPDATED',
      entityType: 'Transaction',
      entityId: updated.id,
      ...metadata,
      metadata: {
        previousAccountId: original.accountId,
        accountId: updated.accountId,
        previousAmount: original.amount.toString(),
        amount: updated.amount.toString(),
        previousType: original.type,
        type: updated.type,
      },
    }, tx);

    return updated;
  });
};

export const deleteTransaction = async (userId: string, id: string, metadata: RequestMetadata) => {
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
    await createAuditLog({
      userId,
      action: 'TRANSACTION_DELETED',
      entityType: 'Transaction',
      entityId: original.id,
      ...metadata,
      metadata: {
        accountId: original.accountId,
        categoryId: original.categoryId,
        type: original.type,
        amount: original.amount.toString(),
      },
    }, tx);
  });
};

export const smartParseTransaction = async (userId: string, input: string) => {
  const cleanInput = input.trim();
  const [categories, accounts, user] = await Promise.all([
    prisma.category.findMany({ where: { userId } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { currency: true } }),
  ]);
  const currency = user?.currency || 'USD';

  // 1. Extract Amount
  let amount = 0;
  const amountMatch = cleanInput.match(
    /(?:(?:lkr|rs|usd|\$|€|£)\.?\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?|[0-9]+k)\b/i,
  );
  if (amountMatch) {
    const rawNum = amountMatch[1].toLowerCase().replace(/,/g, '');
    if (rawNum.endsWith('k')) {
      amount = parseFloat(rawNum.replace('k', '')) * 1000;
    } else {
      amount = parseFloat(rawNum);
    }
  }

  // 2. Determine Type (INCOME vs EXPENSE)
  // Check explicit income signals: salary keywords OR transfer-in patterns ("got money from", "received from", "sent me")
  const incomeKeywords =
    /\b(salary|income|earned|received|got paid|deposit|freelance|dividend|bonus|allowance|refund)\b/i;
  const transferInPattern =
    /\b(got money|received money|money from|sent me|paid me|transfer from|transferred from|cashback|reimbursed)\b/i;
  const isIncome = incomeKeywords.test(cleanInput) || transferInPattern.test(cleanInput);
  const type: 'INCOME' | 'EXPENSE' = isIncome ? 'INCOME' : 'EXPENSE';

  // 3. Extract Date
  let date = new Date();
  if (/\byesterday\b/i.test(cleanInput)) {
    date = addDays(date, -1);
  } else if (/\btomorrow\b/i.test(cleanInput)) {
    date = addDays(date, 1);
  }

  // 4. Match Category
  const lowerInput = cleanInput.toLowerCase();
  let matchedCategory = categories.find((cat) => lowerInput.includes(cat.name.toLowerCase()));

  if (!matchedCategory) {
    const keywordMap: Record<string, string[]> = {
      Food: [
        'keells',
        'cargills',
        'spar',
        'arpico',
        'food',
        'groceries',
        'supermarket',
        'dinner',
        'lunch',
        'breakfast',
        'coffee',
        'cafe',
        'restaurant',
        'burger',
        'pizza',
        'bread',
        'eating outside',
        'snacks',
        'eat',
        'dining',
      ],
      Utilities: [
        'electricity',
        'ceb',
        'water',
        'internet',
        'dialog',
        'mobitel',
        'slt',
        'wifi',
        'utility',
        'phone',
        'bill',
        'recharge',
      ],
      Transportation: ['uber', 'pickme', 'fuel', 'petrol', 'diesel', 'taxi', 'parking', 'bus', 'train', 'transport'],
      Housing: ['rent', 'lease', 'apartment', 'house', 'maintenance'],
      Subscriptions: [
        'netflix',
        'spotify',
        'prime',
        'apple',
        'youtube',
        'gym',
        'movie',
        'cinema',
        'game',
        'subscription',
      ],
      Healthcare: ['pharmacy', 'medicine', 'hospital', 'doctor', 'clinic', 'dentist', 'health'],
      Shopping: ['clothes', 'shoes', 'amazon', 'daraz', 'laptop', 'phone', 'gadget', 'electronics', 'fashion'],
      Salary: ['salary', 'bonus', 'paycheck', 'payroll', 'client'],
    };

    for (const [catName, keywords] of Object.entries(keywordMap)) {
      if (keywords.some((k) => lowerInput.includes(k))) {
        matchedCategory = categories.find((c) => c.name.toLowerCase().includes(catName.toLowerCase()));
        if (matchedCategory) break;
      }
    }
  }

  if (!matchedCategory && categories.length > 0) {
    // Prefer a type-appropriate fallback: income categories for INCOME, expense categories for EXPENSE
    const incomeCategories = categories.filter((c) =>
      /income|salary|revenue|earnings/i.test(c.name),
    );
    const expenseCategories = categories.filter(
      (c) => !/income|salary|revenue|earnings/i.test(c.name),
    );
    if (type === 'INCOME') {
      matchedCategory = incomeCategories[0] || categories[0];
    } else {
      matchedCategory = expenseCategories[0] || categories[0];
    }
  }

  // 5. Match Account
  let matchedAccount = accounts.find((acc) => lowerInput.includes(acc.name.toLowerCase()));
  if (!matchedAccount) {
    if (/\bcash\b/i.test(cleanInput)) {
      matchedAccount = accounts.find((a) => a.type === 'CASH');
    } else if (/\b(bank|card|credit)\b/i.test(cleanInput)) {
      matchedAccount = accounts.find((a) => ['BANK', 'CREDIT'].includes(a.type));
    }
  }
  if (!matchedAccount && accounts.length > 0) {
    matchedAccount = accounts.find((a) => ['BANK', 'CASH', 'WALLET'].includes(a.type)) || accounts[0];
  }

  // 6. Extract Title / Merchant
  let title = cleanInput
    .replace(
      /(?:(?:lkr|rs|usd|\$|€|£)\.?\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?|[0-9]+k)\b/gi,
      '',
    )
    .replace(/\b(spent|paid|bought|got|added|today|yesterday|tomorrow|at|for|on|in|from|to|lkr|rs|usd)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title || title.length < 2) {
    title = matchedCategory ? matchedCategory.name : type === 'INCOME' ? 'Income' : 'Expense';
  } else {
    title = title
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  return {
    title,
    amount: amount || 0,
    type,
    categoryId: matchedCategory?.id || '',
    categoryName: matchedCategory?.name || 'General',
    categoryColor: matchedCategory?.color || '#3b82f6',
    categoryIcon: matchedCategory?.icon || 'receipt',
    accountId: matchedAccount?.id,
    accountName: matchedAccount?.name,
    date: date.toISOString().split('T')[0],
    currency,
    rawText: cleanInput,
  };
};

export const executeAiCommand = async (userId: string, command: string, metadata: RequestMetadata) => {
  const clean = command.trim();
  const lower = clean.toLowerCase();

  const isQuery =
    /^(how much|what did i spend|total spent|how much left|what is my)/i.test(lower) || lower.includes('how much');

  if (isQuery) {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const endOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));

    const categories = await prisma.category.findMany({ where: { userId } });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });
    const currency = user?.currency || 'USD';

    let targetCategory = categories.find((c) => lower.includes(c.name.toLowerCase()));
    if (!targetCategory) {
      if (lower.includes('eat') || lower.includes('food') || lower.includes('outside') || lower.includes('dining')) {
        targetCategory = categories.find((c) => /food|dining|restaurant|groceries/i.test(c.name));
      } else if (
        lower.includes('fuel') ||
        lower.includes('petrol') ||
        lower.includes('transport') ||
        lower.includes('uber')
      ) {
        targetCategory = categories.find((c) => /transport|fuel|travel/i.test(c.name));
      }
    }

    if (targetCategory) {
      const expenses = await prisma.transaction.findMany({
        where: {
          userId,
          categoryId: targetCategory.id,
          type: 'EXPENSE',
          date: { gte: startOfMonth, lte: endOfMonth },
        },
      });

      const total = expenses.reduce((s, t) => s + Number(t.amount), 0);
      const count = expenses.length;

      return {
        success: true,
        action: 'QUERY',
        category: targetCategory.name,
        total,
        count,
        currency,
        message: `You have spent ${currency} ${total.toLocaleString()} across ${count} transaction${count === 1 ? '' : 's'} on ${targetCategory.name} this month.`,
      };
    } else {
      const expenses = await prisma.transaction.findMany({
        where: {
          userId,
          type: 'EXPENSE',
          date: { gte: startOfMonth, lte: endOfMonth },
        },
      });
      const total = expenses.reduce((s, t) => s + Number(t.amount), 0);
      return {
        success: true,
        action: 'QUERY',
        total,
        count: expenses.length,
        currency,
        message: `Your total spending this month is ${currency} ${total.toLocaleString()} across ${expenses.length} transactions.`,
      };
    }
  }

  const parsed = await smartParseTransaction(userId, clean);
  if (!parsed.amount || parsed.amount <= 0) {
    throw badRequest('Could not recognize amount. Please specify an amount, e.g. "Spent 6500 at Cargills"');
  }
  if (!parsed.categoryId) {
    throw badRequest('No category available for this transaction.');
  }

  const created = await createTransaction(
    userId,
    {
      title: parsed.title,
      amount: parsed.amount,
      type: parsed.type,
      categoryId: parsed.categoryId,
      accountId: parsed.accountId,
      date: new Date(parsed.date).toISOString(),
      notes: `Quick captured: "${clean}"`,
    },
    metadata,
  );

  return {
    success: true,
    action: 'CREATE_TRANSACTION',
    message: `Added ${parsed.currency} ${parsed.amount.toLocaleString()} → ${parsed.categoryName} → ${parsed.title}`,
    transaction: created,
    parsed,
  };
};

