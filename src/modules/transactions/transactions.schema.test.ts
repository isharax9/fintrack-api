import { describe, expect, it } from 'vitest';
import { transactionQuerySchema, updateTransactionSchema } from './transactions.schema';

describe('transaction schemas', () => {
  it('coerces pagination defaults for list queries', () => {
    const result = transactionQuerySchema.parse({});

    expect(result).toMatchObject({
      page: 1,
      limit: 10,
    });
  });

  it('accepts search and tag filters for list queries', () => {
    const result = transactionQuerySchema.parse({
      search: 'coffee',
      tagId: 'c123456789012345678901234',
      page: '2',
      limit: '25',
    });

    expect(result).toMatchObject({
      search: 'coffee',
      tagId: 'c123456789012345678901234',
      page: 2,
      limit: 25,
    });
  });

  it('supports disconnecting an account on update', () => {
    const result = updateTransactionSchema.parse({ accountId: null });

    expect(result.accountId).toBeNull();
  });
});
