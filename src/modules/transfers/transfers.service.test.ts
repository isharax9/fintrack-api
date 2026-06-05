import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    account: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    transfer: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  createAuditLog: vi.fn(),
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));
vi.mock('../audit/audit.service', () => ({ createAuditLog: mocks.createAuditLog }));

describe('transfers service money flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma));
  });

  it('rejects same-account transfers before touching the database', async () => {
    const transfersService = await import('./transfers.service');

    await expect(
      transfersService.createTransfer(
        'user_1',
        {
          fromAccountId: 'account_1',
          toAccountId: 'account_1',
          amount: 100,
        },
        {},
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Transfer accounts must be different',
    });

    expect(mocks.prisma.account.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a transfer and moves money between both accounts atomically', async () => {
    const transfersService = await import('./transfers.service');
    mocks.prisma.account.findFirst
      .mockResolvedValueOnce({ id: 'from_account', userId: 'user_1' })
      .mockResolvedValueOnce({ id: 'to_account', userId: 'user_1' });
    mocks.prisma.transfer.create.mockResolvedValue({
      id: 'transfer_1',
      userId: 'user_1',
      fromAccountId: 'from_account',
      toAccountId: 'to_account',
      amount: 250,
      date: new Date('2026-06-05T00:00:00.000Z'),
    });

    const result = await transfersService.createTransfer(
      'user_1',
      {
        fromAccountId: 'from_account',
        toAccountId: 'to_account',
        amount: 250,
        date: '2026-06-05T00:00:00.000Z',
      },
      { requestId: 'req_1' },
    );

    expect(result).toMatchObject({ id: 'transfer_1', amount: 250 });
    expect(mocks.prisma.transfer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        fromAccountId: 'from_account',
        toAccountId: 'to_account',
        amount: 250,
      }),
    });
    expect(mocks.prisma.account.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'from_account' },
      data: { balance: { decrement: 250 } },
    });
    expect(mocks.prisma.account.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'to_account' },
      data: { balance: { increment: 250 } },
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        action: 'TRANSFER_CREATED',
        entityType: 'Transfer',
        entityId: 'transfer_1',
      }),
      mocks.prisma,
    );
  });
});
