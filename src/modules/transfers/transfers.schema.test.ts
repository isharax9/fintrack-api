import { describe, expect, it } from 'vitest';
import { createTransferSchema, transferQuerySchema } from './transfers.schema';

const fromAccountId = 'clv0000000000000000000000';
const toAccountId = 'clv0000000000000000000001';

describe('transfer schemas', () => {
  it('accepts a transfer between two different accounts', () => {
    const result = createTransferSchema.parse({
      fromAccountId,
      toAccountId,
      amount: 125.5,
      date: '2026-06-05T00:00:00.000Z',
    });

    expect(result.amount).toBe(125.5);
  });

  it('rejects a transfer to the same account', () => {
    const result = createTransferSchema.safeParse({
      fromAccountId,
      toAccountId: fromAccountId,
      amount: 125.5,
    });

    expect(result.success).toBe(false);
  });

  it('coerces transfer history query filters and pagination', () => {
    const result = transferQuerySchema.parse({
      accountId: fromAccountId,
      status: 'POSTED',
      page: '2',
      limit: '25',
    });

    expect(result).toEqual({
      accountId: fromAccountId,
      status: 'POSTED',
      page: 2,
      limit: 25,
    });
  });
});
