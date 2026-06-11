import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    category: {
      findUnique: vi.fn(),
    },
    budgetGoal: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  createAuditLog: vi.fn(),
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));
vi.mock('../audit/audit.service', () => ({ createAuditLog: mocks.createAuditLog }));

describe('budget goals service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  });

  it('rejects duplicate budget goals for the same category and month before writing', async () => {
    const budgetGoalsService = await import('./budgetGoals.service');
    mocks.prisma.category.findUnique.mockResolvedValue({ id: 'category_1', userId: 'user_1' });
    mocks.prisma.budgetGoal.findFirst.mockResolvedValue({
      id: 'goal_1',
      userId: 'user_1',
      categoryId: 'category_1',
      month: 6,
      year: 2026,
    });

    await expect(
      budgetGoalsService.createBudgetGoal(
        'user_1',
        {
          categoryId: 'category_1',
          limitAmount: 500,
          month: 6,
          year: 2026,
        },
        { requestId: 'req_1' },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Budget goal already exists for this category in this month',
    });

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });
});
