import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    account: {
      findMany: vi.fn(),
    },
    recurringTransaction: {
      findMany: vi.fn(),
    },
    budgetGoal: {
      findMany: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    savingsGoal: {
      findMany: vi.fn(),
    },
  },
  sendQuickSnapshotEmail: vi.fn(),
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));
vi.mock('../../utils/email', () => ({
  sendQuickSnapshotEmail: mocks.sendQuickSnapshotEmail,
}));

describe('Safe-to-Spend engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates disposable safe-to-spend and daily spending correctly', async () => {
    const { getSafeToSpend } = await import('./reports.service');

    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: 'Ishara',
      email: 'ishara@example.com',
      currency: 'LKR',
      paydayDay: 25,
      paydayAmount: 280000,
      householdEnabled: false,
      householdName: null,
    });

    // Liquid cash: 184,500
    mocks.prisma.account.findMany.mockResolvedValue([
      { id: 'acc_1', name: 'Commercial Bank', type: 'BANK', balance: 150000 },
      { id: 'acc_2', name: 'Cash Wallet', type: 'CASH', balance: 34500 },
    ]);

    // No active recurring income, defaults to paydayDay
    mocks.prisma.recurringTransaction.findMany
      .mockResolvedValueOnce([]) // recurring income
      .mockResolvedValueOnce([   // recurring expenses (bills)
        {
          id: 'bill_1',
          title: 'Internet',
          amount: 6500,
          nextDate: new Date('2026-10-15T00:00:00Z'),
          categoryId: 'cat_util',
          category: { name: 'Utilities', color: '#3b82f6' },
          account: { name: 'Commercial Bank' },
        },
        {
          id: 'bill_2',
          title: 'Rent',
          amount: 45000,
          nextDate: new Date('2026-10-18T00:00:00Z'),
          categoryId: 'cat_rent',
          category: { name: 'Housing', color: '#10b981' },
          account: { name: 'Commercial Bank' },
        },
      ]);

    // Budget goals: 28,000 limit, 0 spent -> 28,000 commitment
    mocks.prisma.budgetGoal.findMany.mockResolvedValue([
      {
        id: 'bg_1',
        categoryId: 'cat_food',
        limitAmount: 28000,
        category: { name: 'Food', color: '#f59e0b' },
      },
    ]);
    mocks.prisma.transaction.groupBy.mockResolvedValue([]); // 0 spent

    // Savings goals: 20,000 commitment
    mocks.prisma.savingsGoal.findMany.mockResolvedValue([
      {
        id: 'sg_1',
        name: 'Emergency Fund',
        targetAmount: 200000,
        currentAmount: 0,
        deadline: null,
      },
    ]);

    const result = await getSafeToSpend('user_1');

    expect(result.currentCash).toBe(184500);
    expect(result.billsBeforeSalary).toBe(51500); // 6500 + 45000
    expect(result.budgetCommitments).toBe(28000);
    expect(result.savingsCommitment).toBe(20000); // 10% of 200k = 20k

    // 184,500 - 51,500 - 28,000 - 20,000 = 85,000
    expect(result.safeToSpend).toBe(85000);
    expect(result.safeDailySpending).toBeGreaterThan(0);
    expect(result.currency).toBe('LKR');
    expect(result.timeline.length).toBeGreaterThan(1);
  });

  it('evaluates simulateSpend correctly for affordable vs excessive amounts', async () => {
    const { simulateSpend } = await import('./reports.service');

    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      name: 'Ishara',
      email: 'ishara@example.com',
      currency: 'LKR',
      paydayDay: 25,
      paydayAmount: 100000,
    });
    mocks.prisma.account.findMany.mockResolvedValue([
      { id: 'acc_1', type: 'BANK', balance: 50000 },
    ]);
    mocks.prisma.recurringTransaction.findMany.mockResolvedValue([]);
    mocks.prisma.budgetGoal.findMany.mockResolvedValue([]);
    mocks.prisma.transaction.groupBy.mockResolvedValue([]);
    mocks.prisma.savingsGoal.findMany.mockResolvedValue([]);

    // Total cash 50,000, 0 bills/commitments -> safeToSpend = 50,000
    const affordable = await simulateSpend('user_1', { amount: 15000 });
    expect(affordable.canAfford).toBe(true);
    expect(affordable.remainingSafeToSpend).toBe(35000);
    expect(affordable.verdict).toContain('Yes! You can spend');

    const excessive = await simulateSpend('user_1', { amount: 65000 });
    expect(excessive.canAfford).toBe(false);
    expect(excessive.remainingSafeToSpend).toBe(-15000);
    expect(excessive.verdict).toContain('Caution: Spending');
  });
});
