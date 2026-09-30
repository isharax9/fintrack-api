import { prisma } from '../../config/db';
import { env } from '../../config/env';
import { CreateTransactionInput, UpdateTransactionInput, TransactionQuery } from './transactions.schema';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '../audit/audit.service';
import { RequestMetadata } from '../../utils/requestContext';
import { badRequest, notFound } from '../../utils/errors';
import { addDays } from 'date-fns';
import { parseWithGemini } from '../../services/ai.service';


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
    const raw = query.search.trim();
    const cleanForNum = raw.replace(/[,$€£¥₹]/g, '').trim();
    const numMatch = cleanForNum.match(/\b\d+(\.\d{1,2})?\b/);
    const num = numMatch ? parseFloat(numMatch[0]) : null;
    const tokens = raw.split(/\s+/).filter((t) => t.length > 0);

    const conditions: Prisma.TransactionWhereInput[] = [
      { title: { contains: raw, mode: 'insensitive' } },
      { notes: { contains: raw, mode: 'insensitive' } },
      { category: { name: { contains: raw, mode: 'insensitive' } } },
      { account: { name: { contains: raw, mode: 'insensitive' } } },
      { tags: { some: { name: { contains: raw, mode: 'insensitive' }, userId } } },
    ];

    for (const token of tokens) {
      const cleanToken = token.replace(/[^a-zA-Z0-9]/g, '');
      if (!cleanToken) continue;

      conditions.push(
        { title: { contains: cleanToken, mode: 'insensitive' } },
        { notes: { contains: cleanToken, mode: 'insensitive' } },
        { category: { name: { contains: cleanToken, mode: 'insensitive' } } },
        { account: { name: { contains: cleanToken, mode: 'insensitive' } } },
      );

      // Suffix/stem matching for close guesses (e.g. "groceries" -> "grocer", "keells" -> "keell")
      if (cleanToken.length > 4) {
        if (cleanToken.endsWith('ies')) {
          const stem = cleanToken.slice(0, -3);
          conditions.push(
            { category: { name: { contains: stem, mode: 'insensitive' } } },
            { title: { contains: stem, mode: 'insensitive' } },
          );
        } else if (cleanToken.endsWith('ing')) {
          const stem = cleanToken.slice(0, -3);
          conditions.push({ title: { contains: stem, mode: 'insensitive' } });
        } else if (cleanToken.endsWith('s') && !cleanToken.endsWith('ss')) {
          const stem = cleanToken.slice(0, -1);
          conditions.push(
            { category: { name: { contains: stem, mode: 'insensitive' } } },
            { title: { contains: stem, mode: 'insensitive' } },
          );
        }
      }
    }

    if (num !== null && !isNaN(num) && num > 0) {
      conditions.push({ amount: num });
      if (Number.isInteger(num)) {
        conditions.push({ amount: { gte: num, lte: num + 0.99 } });
      }
    }

    const upper = raw.toUpperCase();
    if (upper === 'INCOME' || upper === 'SALARY' || upper === 'INFLOW') {
      conditions.push({ type: 'INCOME' });
    } else if (upper === 'EXPENSE' || upper === 'SPENT' || upper === 'OUTFLOW') {
      conditions.push({ type: 'EXPENSE' });
    }

    where.OR = conditions;
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

export const parseWithOfflineAlgorithm = (
  cleanInput: string,
  categories: Array<{ id: string; name: string; color: string; icon: string }>,
  accounts: Array<{ id: string; name: string; type: string }>,
  currency = 'LKR',
) => {
  const lowerInput = cleanInput.toLowerCase();
  let amountScore = 0;
  let categoryScore = 0;
  let typeScore = 0;
  let titleScore = 0;

  // A. Extract Amount (Supports LKR, Rs, $, €, 3000/=, 3000/-, 400k, 12,500.00, 6500)
  let amount = 0;
  const amountMatch = cleanInput.match(
    /(?:(?:lkr|rs|usd|\$|€|£)\.?\s*)?([0-9]+k\b|[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?:\/=|\/-\b|\b)/i,
  );
  if (amountMatch) {
    const rawNum = amountMatch[1].toLowerCase().replace(/,/g, '');
    if (rawNum.endsWith('k')) {
      amount = parseFloat(rawNum.replace('k', '')) * 1000;
    } else {
      amount = parseFloat(rawNum);
    }
    if (amount > 0) {
      amountScore = 0.35;
    }
  }

  // B. Determine Type (INCOME vs EXPENSE)
  const incomeKeywords =
    /\b(salary|income|earned|received|got paid|deposit|freelance|dividend|bonus|allowance|refund|cashback|reimbursed|pocket money|gift)\b/i;
  const transferInPattern =
    /\b(got money|received money|money from|sent me|paid me|transfer from|transferred from|from mom|from dad|from parents)\b/i;
  const expenseKeywords =
    /\b(spent|paid|bought|cost|fee|bill|recharge|order|subscription)\b/i;

  const isIncome = incomeKeywords.test(cleanInput) || transferInPattern.test(cleanInput);
  const isExplicitExpense = expenseKeywords.test(cleanInput);

  let type: 'INCOME' | 'EXPENSE' = 'EXPENSE';
  if (isIncome) {
    type = 'INCOME';
    typeScore = 0.20;
  } else if (isExplicitExpense) {
    type = 'EXPENSE';
    typeScore = 0.20;
  } else {
    type = 'EXPENSE';
    typeScore = 0.08; // default guess without explicit verb
  }

  // C. Extract Date
  let date = new Date();
  if (/\byesterday\b/i.test(cleanInput)) {
    date = addDays(date, -1);
  } else if (/\btomorrow\b/i.test(cleanInput)) {
    date = addDays(date, 1);
  }

  // D. Match Category
  let matchedCategory: (typeof categories)[0] | undefined;

  if (type === 'INCOME') {
    const isFamilyGift = /\b(mom|dad|parents|brother|sister|friend|gift|allowance|pocket)\b/i.test(cleanInput);
    if (isFamilyGift) {
      matchedCategory = categories.find((c) => /allowance|gift|family|pocket/i.test(c.name));
      if (matchedCategory) categoryScore = 0.35;
    }
    if (!matchedCategory) {
      matchedCategory = categories.find((c) => /income|salary|revenue|freelance|earnings/i.test(c.name));
      if (matchedCategory) categoryScore = 0.30;
    }
  } else {
    const keywordMap: Record<string, string[]> = {
      Food: [
        'keells',
        'keels',
        'cargills',
        'food city',
        'spar',
        'arpico',
        'glomark',
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
        'ice-cream',
        'ice cream',
        'bakery',
        'kottu',
        'short eats',
      ],
      Transportation: [
        'uber',
        'pickme',
        'pick me',
        'fuel',
        'petrol',
        'diesel',
        'taxi',
        'parking',
        'bus',
        'train',
        'transport',
        'shede',
        'shed',
        'ioc',
        'ceypetco',
      ],
      Utilities: [
        'electricity',
        'ceb',
        'water',
        'water board',
        'internet',
        'dialog',
        'mobitel',
        'slt',
        'airtel',
        'hutch',
        'wifi',
        'utility',
        'phone',
        'bill',
        'recharge',
      ],
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
      Healthcare: [
        'pharmacy',
        'medicine',
        'hospital',
        'doctor',
        'clinic',
        'dentist',
        'health',
        'asiri',
        'nawaloka',
        'lanka hospital',
        'hemass',
      ],
      Shopping: [
        'clothes',
        'shoes',
        'amazon',
        'daraz',
        'laptop',
        'phone',
        'gadget',
        'electronics',
        'fashion',
        'singer',
        'abans',
        'damro',
      ],
    };

    // Direct name match
    matchedCategory = categories.find((cat) => lowerInput.includes(cat.name.toLowerCase()));
    if (matchedCategory) {
      categoryScore = 0.35;
    } else {
      const categoryRegexMap: Record<string, RegExp> = {
        Food: /food|groceries|dining|restaurant|supermarket|market/i,
        Transportation: /transport|fuel|travel|taxi|vehicle/i,
        Utilities: /utility|utilities|bill|bills|electricity|water|telecom/i,
        Housing: /housing|rent|home|apartment/i,
        Subscriptions: /subscription|subscriptions|entertainment|streaming/i,
        Healthcare: /health|healthcare|medical|medicine|pharmacy/i,
        Shopping: /shopping|electronics|gadget|retail/i,
      };

      // Keyword dictionary match
      for (const [catName, keywords] of Object.entries(keywordMap)) {
        if (keywords.some((k) => lowerInput.includes(k))) {
          const pattern = categoryRegexMap[catName];
          matchedCategory = categories.find((c) =>
            pattern ? pattern.test(c.name) : c.name.toLowerCase().includes(catName.toLowerCase())
          );
          if (matchedCategory) {
            categoryScore = 0.30;
            break;
          }
        }
      }
    }
  }

  // Type-appropriate fallback if still not matched (categoryScore remains 0)
  if (!matchedCategory && categories.length > 0) {
    const incomeCategories = categories.filter((c) =>
      /income|salary|revenue|earnings|allowance|gift/i.test(c.name),
    );
    const expenseCategories = categories.filter(
      (c) => !/income|salary|revenue|earnings|allowance|gift/i.test(c.name),
    );
    if (type === 'INCOME') {
      matchedCategory = incomeCategories[0] || categories[0];
    } else {
      matchedCategory = expenseCategories[0] || categories[0];
    }
  }

  // E. Match Account
  let matchedAccount = accounts.find((acc) => lowerInput.includes(acc.name.toLowerCase()));
  if (!matchedAccount) {
    if (/\bcash\b/i.test(cleanInput)) {
      matchedAccount = accounts.find((a) => a.type === 'CASH');
    } else if (/\b(bank|card|credit|visa|mastercard)\b/i.test(cleanInput)) {
      matchedAccount = accounts.find((a) => ['BANK', 'CREDIT'].includes(a.type));
    }
  }
  if (!matchedAccount && accounts.length > 0) {
    matchedAccount = accounts.find((a) => ['BANK', 'CASH', 'WALLET'].includes(a.type)) || accounts[0];
  }

  // F. Extract Title / Merchant
  let title = '';

  const incomePersonMatch = cleanInput.match(
    /(?:got money|received money|money)\s+from\s+([a-zA-Z\s]+?)(?:\s+[0-9k,.]+|\s+for\s+([a-zA-Z\s]+)|$)/i,
  );
  if (incomePersonMatch && incomePersonMatch[1]) {
    const person = incomePersonMatch[1].trim();
    const reason = incomePersonMatch[2]?.trim();
    title = reason ? `${person} (${reason})` : `From ${person}`;
    titleScore = 0.10;
  }

  if (!title) {
    const merchantMatch = cleanInput.match(/\b(?:at|from)\s+([a-zA-Z0-9\s]+?)(?:\s+today|\s+yesterday|\s+[0-9]|$)/i);
    if (merchantMatch && merchantMatch[1]) {
      const candidate = merchantMatch[1].trim();
      if (candidate.length > 2 && !/^(lkr|rs|usd|cash|bank|card)$/i.test(candidate)) {
        title = candidate;
        titleScore = 0.08;
      }
    }
  }

  const testStr = (title || cleanInput).toLowerCase();
  if (/\b(keells|keels)\b/i.test(testStr)) {
    title = 'Keells';
    titleScore = 0.10;
  } else if (/\b(food city)\b/i.test(testStr)) {
    title = 'Cargills Food City';
    titleScore = 0.10;
  } else if (/\b(cargills)\b/i.test(testStr)) {
    title = 'Cargills';
    titleScore = 0.10;
  } else if (/\b(pickme|pick me)\b/i.test(testStr)) {
    title = 'PickMe';
    titleScore = 0.10;
  } else if (/\buber\b/i.test(testStr)) {
    title = 'Uber';
    titleScore = 0.10;
  } else if (/\bslt\b/i.test(testStr)) {
    title = 'SLT';
    titleScore = 0.10;
  } else if (/\bdialog\b/i.test(testStr)) {
    title = 'Dialog';
    titleScore = 0.10;
  } else if (/\bmobitel\b/i.test(testStr)) {
    title = 'Mobitel';
    titleScore = 0.10;
  } else if (/\bceb\b/i.test(testStr)) {
    title = 'CEB';
    titleScore = 0.10;
  } else if (/\bdaraz\b/i.test(testStr)) {
    title = 'Daraz';
    titleScore = 0.10;
  }

  if (!title) {
    title = cleanInput
      .replace(
        /(?:(?:lkr|rs|usd|\$|€|£)\.?\s*)?([0-9]+k\b|[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?:\/=|\/-\b|\b)/gi,
        '',
      )
      .replace(
        /\b(spent|paid|bought|got|added|today|yesterday|tomorrow|at|for|on|in|from|to|lkr|rs|usd|money)\b/gi,
        '',
      )
      .replace(/\s+/g, ' ')
      .trim();
    if (title.length >= 2) titleScore = 0.05;
  }

  if (!title || title.length < 2) {
    title = matchedCategory ? matchedCategory.name : type === 'INCOME' ? 'Income' : 'Expense';
  } else {
    title = title
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  const confidence = Math.min(1.0, Math.round((amountScore + categoryScore + typeScore + titleScore) * 100) / 100);

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
    source: 'algorithm' as const,
    confidence,
  };
};

export const smartParseTransaction = async (userId: string, input: string) => {
  const cleanInput = input.trim();
  const [categories, accounts, user] = await Promise.all([
    prisma.category.findMany({ where: { userId } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { currency: true } }),
  ]);
  const currency = user?.currency || 'USD';

  // ── Step 1: Run the fast local offline algorithm ──
  const offlineParsed = parseWithOfflineAlgorithm(cleanInput, categories, accounts, currency);

  // ── Step 2: Check Confidence Score threshold (Confidence >= 0.85) ──
  // If the local algorithm is confident (amount found, category recognized, entity identified),
  // return immediately with zero network latency and zero LLM cost!
  if (offlineParsed.amount > 0 && offlineParsed.confidence >= 0.85) {
    return offlineParsed;
  }

  // ── Step 3: Confidence < 0.85 -> Escalate to Google Gemini AI ──
  // Disambiguate complex, messy, or slang inputs using Google Gemini 2.5 Flash
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (apiKey && apiKey.trim() !== '') {
    const geminiResult = await parseWithGemini(cleanInput, categories, accounts, currency);
    if (geminiResult && geminiResult.amount > 0) {
      const matchedCategory = categories.find(
        (c) => c.name.toLowerCase() === geminiResult.categoryName.toLowerCase(),
      ) || categories.find(
        (c) =>
          c.name.toLowerCase().includes(geminiResult.categoryName.toLowerCase()) ||
          geminiResult.categoryName.toLowerCase().includes(c.name.toLowerCase()),
      );

      let matchedAccount;
      if (geminiResult.accountName) {
        matchedAccount = accounts.find((a) =>
          a.name.toLowerCase().includes(geminiResult.accountName!.toLowerCase()),
        );
      }

      const fallbackCat = geminiResult.type === 'INCOME'
        ? categories.find((c) => /income|salary|allowance|gift/i.test(c.name)) || categories[0]
        : categories.find((c) => !/income|salary|allowance|gift/i.test(c.name)) || categories[0];

      const category = matchedCategory || fallbackCat;
      const account = matchedAccount || accounts[0];

      return {
        title: geminiResult.title,
        amount: geminiResult.amount,
        type: geminiResult.type,
        categoryId: category?.id || '',
        categoryName: category?.name || 'General',
        categoryColor: category?.color || '#3b82f6',
        categoryIcon: category?.icon || 'receipt',
        accountId: account?.id,
        accountName: account?.name,
        date: geminiResult.date || new Date().toISOString().split('T')[0],
        currency,
        rawText: cleanInput,
        source: 'gemini' as const,
        confidence: geminiResult.confidence || 0.98,
      };
    }
  }

  // Fallback: return offline algorithm result if Gemini is not configured or offline
  return offlineParsed;
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

