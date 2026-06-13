import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    category: {
      findUnique: vi.fn(),
    },
    account: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  createAuditLog: vi.fn(),
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));
vi.mock('../audit/audit.service', () => ({ createAuditLog: mocks.createAuditLog }));

describe('transactions service money flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  });

  it('builds search and tag filters without leaking another user tag', async () => {
    const transactionsService = await import('./transactions.service');
    mocks.prisma.tag.findFirst.mockResolvedValue({ id: 'c123456789012345678901234' });
    mocks.prisma.transaction.findMany.mockResolvedValue([]);
    mocks.prisma.transaction.count.mockResolvedValue(0);

    await transactionsService.listTransactions('user_1', {
      search: 'coffee',
      tagId: 'c123456789012345678901234',
      page: 1,
      limit: 10,
    });

    expect(mocks.prisma.tag.findFirst).toHaveBeenCalledWith({
      where: { id: 'c123456789012345678901234', userId: 'user_1' },
      select: { id: true },
    });
    expect(mocks.prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user_1',
          tags: { some: { id: 'c123456789012345678901234', userId: 'user_1' } },
          OR: expect.arrayContaining([
            { title: { contains: 'coffee', mode: 'insensitive' } },
            { notes: { contains: 'coffee', mode: 'insensitive' } },
            { category: { name: { contains: 'coffee', mode: 'insensitive' } } },
            { account: { name: { contains: 'coffee', mode: 'insensitive' } } },
            { tags: { some: { name: { contains: 'coffee', mode: 'insensitive' }, userId: 'user_1' } } },
          ]),
        }),
        include: { account: true, category: true, tags: true },
      }),
    );
  });

  it('rejects a tag filter that is not owned by the user', async () => {
    const transactionsService = await import('./transactions.service');
    mocks.prisma.tag.findFirst.mockResolvedValue(null);

    await expect(
      transactionsService.listTransactions('user_1', {
        tagId: 'c123456789012345678901234',
        page: 1,
        limit: 10,
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Invalid tag',
    });
    expect(mocks.prisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it('creates an income transaction and increments the linked account balance', async () => {
    const transactionsService = await import('./transactions.service');
    mocks.prisma.category.findUnique.mockResolvedValue({ id: 'category_1', userId: 'user_1' });
    mocks.prisma.account.findUnique.mockResolvedValue({ id: 'account_1', userId: 'user_1' });
    mocks.prisma.transaction.create.mockResolvedValue({
      id: 'transaction_1',
      userId: 'user_1',
      accountId: 'account_1',
      categoryId: 'category_1',
      title: 'Salary',
      amount: 500,
      type: 'INCOME',
    });

    const result = await transactionsService.createTransaction(
      'user_1',
      {
        title: 'Salary',
        amount: 500,
        type: 'INCOME',
        categoryId: 'category_1',
        accountId: 'account_1',
        date: '2026-06-05T00:00:00.000Z',
      },
      { requestId: 'req_1' },
    );

    expect(result).toMatchObject({ id: 'transaction_1', amount: 500, type: 'INCOME' });
    expect(mocks.prisma.account.update).toHaveBeenCalledWith({
      where: { id: 'account_1' },
      data: { balance: { increment: 500 } },
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        action: 'TRANSACTION_CREATED',
        entityType: 'Transaction',
        entityId: 'transaction_1',
      }),
      mocks.prisma,
    );
  });

  it('rejects a transaction linked to an account owned by another user', async () => {
    const transactionsService = await import('./transactions.service');
    mocks.prisma.category.findUnique.mockResolvedValue({ id: 'category_1', userId: 'user_1' });
    mocks.prisma.account.findUnique.mockResolvedValue({ id: 'account_1', userId: 'user_2' });

    await expect(
      transactionsService.createTransaction(
        'user_1',
        {
          title: 'Rent',
          amount: 100,
          type: 'EXPENSE',
          categoryId: 'category_1',
          accountId: 'account_1',
          date: '2026-06-05T00:00:00.000Z',
        },
        {},
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Invalid account',
    });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deletes an expense transaction and reverses its account balance impact', async () => {
    const transactionsService = await import('./transactions.service');
    mocks.prisma.transaction.findUnique.mockResolvedValue({
      id: 'transaction_1',
      userId: 'user_1',
      accountId: 'account_1',
      categoryId: 'category_1',
      amount: 75,
      type: 'EXPENSE',
    });

    await transactionsService.deleteTransaction('user_1', 'transaction_1', { requestId: 'req_2' });

    expect(mocks.prisma.account.update).toHaveBeenCalledWith({
      where: { id: 'account_1' },
      data: { balance: { increment: 75 } },
    });
    expect(mocks.prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: 'transaction_1' } });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TRANSACTION_DELETED',
        entityId: 'transaction_1',
      }),
      mocks.prisma,
    );
  });
});
