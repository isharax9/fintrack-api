import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    account: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  createAuditLog: vi.fn(),
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));
vi.mock('../audit/audit.service', () => ({ createAuditLog: mocks.createAuditLog }));

describe('imports service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
    mocks.prisma.account.findMany.mockResolvedValue([
      { id: 'account_1', name: 'Checking' },
    ]);
    mocks.prisma.category.findMany.mockResolvedValue([
      { id: 'category_1', name: 'Food' },
      { id: 'category_2', name: 'Income' },
    ]);
    mocks.prisma.tag.findMany.mockResolvedValue([
      { id: 'tag_1', name: 'Groceries' },
    ]);
    mocks.prisma.transaction.findMany.mockResolvedValue([]);
    mocks.prisma.transaction.create.mockImplementation(async ({ data }) => ({
      id: `transaction_${data.title}`,
      accountId: data.account?.connect?.id || null,
      categoryId: data.category.connect.id,
      amount: data.amount,
      type: data.type,
    }));
  });

  it('previews valid rows and reports row-level validation errors without writing', async () => {
    const importsService = await import('./imports.service');
    const csv = [
      'date,title,amount,type,account,category,notes,tags',
      '2026-06-01,Groceries,42.50,EXPENSE,Checking,Food,Weekly shop,Groceries',
      'bad-date,,nope,OTHER,Missing,Unknown,,MissingTag',
    ].join('\n');

    const result = await importsService.importTransactionsCsv('user_1', csv, true, { requestId: 'req_1' });

    expect(result).toMatchObject({
      dryRun: true,
      totalRows: 2,
      validRows: 1,
      errorRows: 1,
      duplicateRows: 0,
      importedRows: 0,
    });
    expect(result.rows[0]).toMatchObject({
      rowNumber: 2,
      status: 'valid',
      data: {
        title: 'Groceries',
        amount: 42.5,
        type: 'EXPENSE',
        accountId: 'account_1',
        categoryId: 'category_1',
        tagIds: ['tag_1'],
      },
    });
    expect(result.rows[1].status).toBe('error');
    expect(result.rows[1].errors).toEqual(expect.arrayContaining([
      'Title is required',
      'Amount must be a positive number',
      'Type must be INCOME or EXPENSE',
      'Date must be a valid ISO date or YYYY-MM-DD value',
      'Category must match a user-owned category id or name',
      'Account must match a user-owned account id or name',
      'Tag "MissingTag" must match a user-owned tag id or name',
    ]));
    expect(mocks.prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('imports non-duplicate rows, skips duplicates, updates balances, and audits the import', async () => {
    const importsService = await import('./imports.service');
    const csv = [
      'date,title,amount,type,account,category,notes,tags',
      '2026-06-01,Groceries,42.50,EXPENSE,Checking,Food,Weekly shop,Groceries',
      '2026-06-02,Paycheck,1000,INCOME,Checking,Income,,',
      '2026-06-02,Paycheck,1000,INCOME,Checking,Income,,',
    ].join('\n');

    const result = await importsService.importTransactionsCsv('user_1', csv, false, { requestId: 'req_1' });

    expect(result).toMatchObject({
      dryRun: false,
      totalRows: 3,
      validRows: 1,
      errorRows: 0,
      duplicateRows: 2,
      importedRows: 1,
      skippedRows: 2,
    });
    expect(mocks.prisma.transaction.create).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: 'Groceries',
        amount: 42.5,
        type: 'EXPENSE',
      }),
    }));
    expect(mocks.prisma.account.update).toHaveBeenCalledWith({
      where: { id: 'account_1' },
      data: { balance: { increment: -42.5 } },
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IMPORT_TRANSACTIONS_CSV',
        entityType: 'Import',
        metadata: expect.objectContaining({ importedRows: 1, skippedRows: 2, totalRows: 3 }),
      }),
      mocks.prisma,
    );
  });
});

