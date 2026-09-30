import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    category: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    budgetGoal: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    envelopeTransfer: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    transaction: {
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  createAuditLog: vi.fn(),
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));
vi.mock('../audit/audit.service', () => ({ createAuditLog: mocks.createAuditLog }));
vi.mock('../notifications/notifications.service', () => ({ createNotification: vi.fn() }));

describe('Goodbudget Envelopes system', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates envelope balances, remaining cash, and statuses', async () => {
    const { getEnvelopes } = await import('./budgetGoals.service');

    mocks.prisma.category.findMany.mockResolvedValue([
      { id: 'cat_groceries', name: 'Groceries', color: '#10b981', icon: 'shopping-cart' },
      { id: 'cat_dining', name: 'Dining Out', color: '#f59e0b', icon: 'utensils' },
    ]);
    mocks.prisma.budgetGoal.findMany.mockResolvedValue([
      { id: 'bg_1', categoryId: 'cat_groceries', limitAmount: 40000, month: 10, year: 2026 },
      { id: 'bg_2', categoryId: 'cat_dining', limitAmount: 15000, month: 10, year: 2026 },
    ]);
    mocks.prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: 'cat_groceries', _sum: { amount: 25000 } }, // 15,000 left
      { categoryId: 'cat_dining', _sum: { amount: 18000 } },    // overspent by 3,000
    ]);
    mocks.prisma.envelopeTransfer.findMany.mockResolvedValue([]);

    const result = await getEnvelopes('user_1', { month: 10, year: 2026 });

    expect(result.totalBudgeted).toBe(55000);
    expect(result.totalSpent).toBe(43000);
    expect(result.envelopes).toHaveLength(2);

    const groceries = result.envelopes.find((e) => e.categoryId === 'cat_groceries')!;
    expect(groceries.limit).toBe(40000);
    expect(groceries.spent).toBe(25000);
    expect(groceries.remaining).toBe(15000);
    expect(groceries.status).toBe('healthy');

    const dining = result.envelopes.find((e) => e.categoryId === 'cat_dining')!;
    expect(dining.remaining).toBe(-3000);
    expect(dining.status).toBe('overspent');
  });

  it('executes an envelope transfer between two categories atomically', async () => {
    const { transferEnvelopeFunds } = await import('./budgetGoals.service');

    mocks.prisma.category.findFirst
      .mockResolvedValueOnce({ id: 'cat_groceries', name: 'Groceries' })
      .mockResolvedValueOnce({ id: 'cat_dining', name: 'Dining Out' });

    mocks.prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        budgetGoal: {
          findFirst: vi.fn()
            .mockResolvedValueOnce({ id: 'bg_1', limitAmount: 40000 })
            .mockResolvedValueOnce({ id: 'bg_2', limitAmount: 15000 }),
          update: vi.fn()
            .mockResolvedValueOnce({ id: 'bg_1', limitAmount: 35000 })
            .mockResolvedValueOnce({ id: 'bg_2', limitAmount: 20000 }),
        },
        envelopeTransfer: {
          create: vi.fn().mockResolvedValue({ id: 'et_1', amount: 5000 }),
        },
      };
      return callback(tx);
    });

    const result = await transferEnvelopeFunds(
      'user_1',
      {
        fromCategoryId: 'cat_groceries',
        toCategoryId: 'cat_dining',
        amount: 5000,
        month: 10,
        year: 2026,
        note: 'Cover weekend dinner',
      },
      { ipAddress: '127.0.0.1', userAgent: 'test' },
    );

    expect(result.transfer.amount).toBe(5000);
    expect(result.fromEnvelope.limitAmount).toBe(35000);
    expect(result.toEnvelope.limitAmount).toBe(20000);
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ENVELOPE_TRANSFER_EXECUTED' }),
      expect.anything(),
    );
  });
});
