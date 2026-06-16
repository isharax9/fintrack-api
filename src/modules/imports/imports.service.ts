import { Prisma, TransactionType } from '@prisma/client';
import { prisma } from '../../config/db';
import { createAuditLog } from '../audit/audit.service';
import { RequestMetadata } from '../../utils/requestContext';
import { badRequest } from '../../utils/errors';
import { parseCsv } from './csv';

type ImportRowStatus = 'valid' | 'error' | 'duplicate' | 'imported' | 'skipped';

type ParsedTransaction = {
  rowNumber: number;
  title: string;
  amount: number;
  type: TransactionType;
  date: Date;
  categoryId: string;
  accountId?: string;
  notes?: string;
  tagIds: string[];
  duplicateKey: string;
};

type ImportPreviewRow = {
  rowNumber: number;
  status: ImportRowStatus;
  errors: string[];
  data?: {
    title: string;
    amount: number;
    type: TransactionType;
    date: string;
    categoryId: string;
    accountId?: string;
    notes?: string;
    tagIds: string[];
  };
};

export type ImportTransactionsResult = {
  dryRun: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  importedRows: number;
  skippedRows: number;
  rows: ImportPreviewRow[];
};

const REQUIRED_HEADERS = ['date', 'title', 'amount', 'type', 'category'];
const OPTIONAL_HEADERS = ['account', 'notes', 'tags'];
const MAX_ROWS = 500;

const normalizeHeader = (value: string) => value.trim().replace(/^\uFEFF/, '').toLowerCase();
const normalizeLookup = (value: string) => value.trim().toLowerCase();

const parseAmount = (value: string) => {
  const normalized = value.replace(/[$£€,\s]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.abs(amount) : NaN;
};

const parseType = (value: string): TransactionType | null => {
  const normalized = value.trim().toUpperCase();
  if (normalized === TransactionType.INCOME) return TransactionType.INCOME;
  if (normalized === TransactionType.EXPENSE) return TransactionType.EXPENSE;
  return null;
};

const parseDate = (value: string) => {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildDuplicateKey = (row: Omit<ParsedTransaction, 'duplicateKey' | 'rowNumber'>) => [
  row.date.toISOString(),
  row.title.trim().toLowerCase(),
  row.amount.toFixed(2),
  row.type,
  row.categoryId,
  row.accountId || 'no-account',
].join('|');

const toPreviewData = (row: ParsedTransaction) => ({
  title: row.title,
  amount: row.amount,
  type: row.type,
  date: row.date.toISOString(),
  categoryId: row.categoryId,
  accountId: row.accountId,
  notes: row.notes,
  tagIds: row.tagIds,
});

export const importTransactionsCsv = async (
  userId: string,
  csvText: string,
  dryRun: boolean,
  metadata: RequestMetadata,
): Promise<ImportTransactionsResult> => {
  const csvRows = parseCsv(csvText);
  if (csvRows.length < 2) throw badRequest('CSV must include a header row and at least one data row');

  const headers = csvRows[0].map(normalizeHeader);
  const unknownHeaders = headers.filter((header) => !REQUIRED_HEADERS.includes(header) && !OPTIONAL_HEADERS.includes(header));
  if (unknownHeaders.length > 0) throw badRequest(`Unsupported CSV columns: ${unknownHeaders.join(', ')}`);

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) throw badRequest(`Missing required CSV columns: ${missingHeaders.join(', ')}`);

  const dataRows = csvRows.slice(1);
  if (dataRows.length > MAX_ROWS) throw badRequest(`CSV imports are limited to ${MAX_ROWS} rows per upload`);

  const columnIndex = (name: string) => headers.indexOf(name);
  const getCell = (row: string[], name: string) => {
    const index = columnIndex(name);
    return index >= 0 ? row[index]?.trim() || '' : '';
  };

  const [accounts, categories, tags] = await Promise.all([
    prisma.account.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.category.findMany({ where: { userId }, select: { id: true, name: true } }),
    prisma.tag.findMany({ where: { userId }, select: { id: true, name: true } }),
  ]);

  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const accountsByName = new Map(accounts.map((account) => [normalizeLookup(account.name), account]));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const categoriesByName = new Map(categories.map((category) => [normalizeLookup(category.name), category]));
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  const tagsByName = new Map(tags.map((tag) => [normalizeLookup(tag.name), tag]));

  const parsedRows: ParsedTransaction[] = [];
  const previewRows: ImportPreviewRow[] = [];

  dataRows.forEach((csvRow, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];
    const title = getCell(csvRow, 'title');
    const amount = parseAmount(getCell(csvRow, 'amount'));
    const type = parseType(getCell(csvRow, 'type'));
    const date = parseDate(getCell(csvRow, 'date'));
    const categoryValue = getCell(csvRow, 'category');
    const accountValue = getCell(csvRow, 'account');
    const notes = getCell(csvRow, 'notes') || undefined;
    const tagValues = getCell(csvRow, 'tags')
      .split(/[;|]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    if (!title) errors.push('Title is required');
    if (!Number.isFinite(amount) || amount <= 0) errors.push('Amount must be a positive number');
    if (!type) errors.push('Type must be INCOME or EXPENSE');
    if (!date) errors.push('Date must be a valid ISO date or YYYY-MM-DD value');

    const category = categoriesById.get(categoryValue) || categoriesByName.get(normalizeLookup(categoryValue));
    if (!category) errors.push('Category must match a user-owned category id or name');

    const account = accountValue
      ? accountsById.get(accountValue) || accountsByName.get(normalizeLookup(accountValue))
      : undefined;
    if (accountValue && !account) errors.push('Account must match a user-owned account id or name');

    const tagIds: string[] = [];
    for (const tagValue of tagValues) {
      const tag = tagsById.get(tagValue) || tagsByName.get(normalizeLookup(tagValue));
      if (!tag) {
        errors.push(`Tag "${tagValue}" must match a user-owned tag id or name`);
      } else {
        tagIds.push(tag.id);
      }
    }

    if (errors.length > 0 || !type || !date || !category) {
      previewRows.push({ rowNumber, status: 'error', errors });
      return;
    }

    const parsed: Omit<ParsedTransaction, 'duplicateKey'> = {
      rowNumber,
      title,
      amount,
      type,
      date,
      categoryId: category.id,
      accountId: account?.id,
      notes,
      tagIds: [...new Set(tagIds)],
    };

    const parsedWithKey = {
      ...parsed,
      duplicateKey: buildDuplicateKey(parsed),
    };

    parsedRows.push(parsedWithKey);
    previewRows.push({
      rowNumber,
      status: 'valid',
      errors: [],
      data: toPreviewData(parsedWithKey),
    });
  });

  const duplicateKeys = new Set<string>();
  const seenKeys = new Set<string>();
  parsedRows.forEach((row) => {
    if (seenKeys.has(row.duplicateKey)) duplicateKeys.add(row.duplicateKey);
    seenKeys.add(row.duplicateKey);
  });

  if (parsedRows.length > 0) {
    const existing = await prisma.transaction.findMany({
      where: {
        userId,
        OR: parsedRows.map((row) => ({
          title: row.title,
          amount: new Prisma.Decimal(row.amount),
          type: row.type,
          date: row.date,
          categoryId: row.categoryId,
          accountId: row.accountId || null,
        })),
      },
      select: { title: true, amount: true, type: true, date: true, categoryId: true, accountId: true },
    });

    existing.forEach((row) => {
      duplicateKeys.add(buildDuplicateKey({
        title: row.title,
        amount: Number(row.amount),
        type: row.type,
        date: row.date,
        categoryId: row.categoryId,
        accountId: row.accountId || undefined,
        notes: undefined,
        tagIds: [],
      }));
    });
  }

  const rowsByNumber = new Map(parsedRows.map((row) => [row.rowNumber, row]));
  const finalRows = previewRows.map((row) => {
    const parsed = rowsByNumber.get(row.rowNumber);
    if (!parsed || !duplicateKeys.has(parsed.duplicateKey)) return row;
    return { ...row, status: 'duplicate' as const, errors: ['Duplicate transaction detected'] };
  });

  const rowsToImport = parsedRows.filter((row) => !duplicateKeys.has(row.duplicateKey));
  const errorRows = finalRows.filter((row) => row.status === 'error').length;
  const duplicateRows = finalRows.filter((row) => row.status === 'duplicate').length;

  if (dryRun || rowsToImport.length === 0) {
    return {
      dryRun,
      totalRows: dataRows.length,
      validRows: rowsToImport.length,
      errorRows,
      duplicateRows,
      importedRows: 0,
      skippedRows: duplicateRows,
      rows: finalRows,
    };
  }

  if (errorRows > 0) throw badRequest('CSV contains validation errors. Run a dry run and fix invalid rows before importing.');

  await prisma.$transaction(async (tx) => {
    for (const row of rowsToImport) {
      const transaction = await tx.transaction.create({
        data: {
          user: { connect: { id: userId } },
          category: { connect: { id: row.categoryId } },
          account: row.accountId ? { connect: { id: row.accountId } } : undefined,
          title: row.title,
          amount: row.amount,
          type: row.type,
          date: row.date,
          notes: row.notes,
          tags: row.tagIds.length > 0 ? { connect: row.tagIds.map((id) => ({ id })) } : undefined,
        },
      });

      if (row.accountId) {
        await tx.account.update({
          where: { id: row.accountId },
          data: { balance: { increment: row.type === TransactionType.INCOME ? row.amount : -row.amount } },
        });
      }

      await createAuditLog({
        userId,
        action: 'TRANSACTION_IMPORTED',
        entityType: 'Transaction',
        entityId: transaction.id,
        ...metadata,
        metadata: {
          accountId: transaction.accountId,
          categoryId: transaction.categoryId,
          amount: transaction.amount.toString(),
          type: transaction.type,
          source: 'csv',
        },
      }, tx);
    }

    await createAuditLog({
      userId,
      action: 'IMPORT_TRANSACTIONS_CSV',
      entityType: 'Import',
      ...metadata,
      metadata: {
        importedRows: rowsToImport.length,
        skippedRows: duplicateRows,
        totalRows: dataRows.length,
      },
    }, tx);
  });

  return {
    dryRun,
    totalRows: dataRows.length,
    validRows: rowsToImport.length,
    errorRows,
    duplicateRows,
    importedRows: rowsToImport.length,
    skippedRows: duplicateRows,
    rows: finalRows.map((row) => row.status === 'valid' ? { ...row, status: 'imported' } : row),
  };
};

