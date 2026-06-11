import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    savingsGoal: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    savingsBucket: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  createAuditLog: vi.fn(),
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));
vi.mock('../audit/audit.service', () => ({ createAuditLog: mocks.createAuditLog }));

describe('savings service allocations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  });

  it('allocates savings goal funds atomically and writes an audit log', async () => {
    const savingsService = await import('./savings.service');
    mocks.prisma.savingsGoal.findFirst.mockResolvedValue({
      id: 'goal_1',
      userId: 'user_1',
      currentAmount: 25,
    });
    mocks.prisma.savingsBucket.findUnique.mockResolvedValue({
      id: 'bucket_1',
      userId: 'user_1',
      balance: 300,
    });
    mocks.prisma.savingsGoal.update.mockResolvedValue({
      id: 'goal_1',
      userId: 'user_1',
      currentAmount: 125,
    });

    const result = await savingsService.allocateGoalFunds(
      'user_1',
      'goal_1',
      { amount: 100 },
      { requestId: 'req_1' },
    );

    expect(mocks.prisma.savingsBucket.update).toHaveBeenCalledWith({
      where: { id: 'bucket_1' },
      data: { balance: { decrement: 100 } },
    });
    expect(mocks.prisma.savingsGoal.update).toHaveBeenCalledWith({
      where: { id: 'goal_1' },
      data: { currentAmount: { increment: 100 } },
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        action: 'SAVINGS_GOAL_ALLOCATED',
        entityType: 'SavingsGoal',
        entityId: 'goal_1',
        metadata: { amount: 100 },
      }),
      mocks.prisma,
    );
    expect(result).toMatchObject({ id: 'goal_1', currentAmount: 125 });
  });

  it('rejects allocations that exceed the savings bucket balance', async () => {
    const savingsService = await import('./savings.service');
    mocks.prisma.savingsGoal.findFirst.mockResolvedValue({
      id: 'goal_1',
      userId: 'user_1',
      currentAmount: 25,
    });
    mocks.prisma.savingsBucket.findUnique.mockResolvedValue({
      id: 'bucket_1',
      userId: 'user_1',
      balance: 40,
    });

    await expect(
      savingsService.allocateGoalFunds(
        'user_1',
        'goal_1',
        { amount: 100 },
        { requestId: 'req_2' },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Insufficient funds in Savings Bucket',
    });

    expect(mocks.prisma.savingsBucket.update).not.toHaveBeenCalled();
    expect(mocks.prisma.savingsGoal.update).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });
});
