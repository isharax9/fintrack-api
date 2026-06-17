import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    transaction: {
      groupBy: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));

describe('reports service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns monthly category income, expenses, and net flow separately', async () => {
    const reportsService = await import('./reports.service');
    mocks.prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: 'transport', type: 'INCOME', _sum: { amount: 60 } },
      { categoryId: 'transport', type: 'EXPENSE', _sum: { amount: 40 } },
      { categoryId: 'food', type: 'EXPENSE', _sum: { amount: 25 } },
    ]);
    mocks.prisma.category.findMany.mockResolvedValue([
      { id: 'transport', name: 'Transport', color: '#4ECDC4', icon: 'car' },
      { id: 'food', name: 'Food', color: '#FF6B6B', icon: 'utensils' },
    ]);

    const result = await reportsService.getCategoryFlow('user_1', { month: 6, year: 2026 });

    expect(result).toEqual([
      {
        categoryId: 'transport',
        categoryName: 'Transport',
        color: '#4ECDC4',
        icon: 'car',
        incomeAmount: 60,
        expenseAmount: 40,
        netAmount: 20,
      },
      {
        categoryId: 'food',
        categoryName: 'Food',
        color: '#FF6B6B',
        icon: 'utensils',
        incomeAmount: 0,
        expenseAmount: 25,
        netAmount: -25,
      },
    ]);
    expect(mocks.prisma.transaction.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ['categoryId', 'type'],
      where: expect.objectContaining({ userId: 'user_1' }),
    }));
  });
});
