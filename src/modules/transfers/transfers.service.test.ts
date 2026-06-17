import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    account: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    transfer: {
      create: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
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
      status: 'POSTED',
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
        status: 'POSTED',
      }),
      include: expect.any(Object),
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

  it('lists transfers with filters and pagination metadata', async () => {
    const transfersService = await import('./transfers.service');
    mocks.prisma.transfer.findMany.mockResolvedValue([{ id: 'transfer_1' }]);
    mocks.prisma.transfer.count.mockResolvedValue(1);

    const result = await transfersService.listTransfers('user_1', {
      accountId: 'account_1',
      status: 'POSTED',
      page: 2,
      limit: 5,
    });

    expect(mocks.prisma.transfer.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        OR: [{ fromAccountId: 'account_1' }, { toAccountId: 'account_1' }],
        status: 'POSTED',
      },
      include: expect.any(Object),
      orderBy: { date: 'desc' },
      skip: 5,
      take: 5,
    });
    expect(result).toEqual({
      data: [{ id: 'transfer_1' }],
      meta: { total: 1, page: 2, limit: 5, totalPages: 1 },
    });
  });

  it('reverses a posted transfer by moving balances back and creating a linked reversal transfer', async () => {
    const transfersService = await import('./transfers.service');
    const original = {
      id: 'transfer_1',
      userId: 'user_1',
      fromAccountId: 'from_account',
      toAccountId: 'to_account',
      amount: 250,
      status: 'POSTED',
      reversal: null,
    };
    const reversal = {
      id: 'transfer_2',
      userId: 'user_1',
      fromAccountId: 'to_account',
      toAccountId: 'from_account',
      amount: 250,
      date: new Date('2026-06-06T00:00:00.000Z'),
      status: 'REVERSAL',
      reversalOfId: 'transfer_1',
    };
    mocks.prisma.transfer.findFirst.mockResolvedValue(original);
    mocks.prisma.transfer.create.mockResolvedValue(reversal);

    const result = await transfersService.reverseTransfer(
      'user_1',
      'transfer_1',
      { notes: 'Duplicate movement' },
      { requestId: 'req_reverse' },
    );

    expect(result).toBe(reversal);
    expect(mocks.prisma.account.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'from_account' },
      data: { balance: { increment: 250 } },
    });
    expect(mocks.prisma.account.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'to_account' },
      data: { balance: { decrement: 250 } },
    });
    expect(mocks.prisma.transfer.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        fromAccountId: 'to_account',
        toAccountId: 'from_account',
        amount: 250,
        notes: 'Duplicate movement',
        status: 'REVERSAL',
        reversalOfId: 'transfer_1',
      }),
      include: expect.any(Object),
    });
    expect(mocks.prisma.transfer.update).toHaveBeenCalledWith({
      where: { id: 'transfer_1' },
      data: {
        status: 'REVERSED',
        reversedAt: reversal.date,
      },
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        action: 'TRANSFER_REVERSED',
        entityType: 'Transfer',
        entityId: 'transfer_1',
      }),
      mocks.prisma,
    );
  });

  it('rejects reversing a transfer that is not posted', async () => {
    const transfersService = await import('./transfers.service');
    mocks.prisma.transfer.findFirst.mockResolvedValue({
      id: 'transfer_1',
      userId: 'user_1',
      status: 'REVERSED',
      reversal: { id: 'transfer_2' },
    });

    await expect(
      transfersService.reverseTransfer('user_1', 'transfer_1', {}, {}),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Only posted transfers can be reversed',
    });

    expect(mocks.prisma.account.update).not.toHaveBeenCalled();
    expect(mocks.prisma.transfer.create).not.toHaveBeenCalled();
  });
});
