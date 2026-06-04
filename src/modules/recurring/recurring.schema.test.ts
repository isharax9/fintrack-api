import { describe, expect, it } from 'vitest';
import { createRecurringSchema, recurringQuerySchema, updateRecurringSchema } from './recurring.schema';

const cuid = 'clv0000000000000000000000';

describe('recurring schemas', () => {
  it('accepts a biweekly recurring transaction template', () => {
    const result = createRecurringSchema.parse({
      accountId: cuid,
      title: 'Salary',
      amount: 2500,
      type: 'INCOME',
      categoryId: cuid,
      frequency: 'BIWEEKLY',
      nextDate: '2026-06-05T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      frequency: 'BIWEEKLY',
      isActive: true,
    });
  });

  it('allows pausing a recurring transaction', () => {
    const result = updateRecurringSchema.parse({ isActive: false });

    expect(result.isActive).toBe(false);
  });

  it('does not apply create defaults to empty updates', () => {
    const result = updateRecurringSchema.parse({});

    expect(result).toEqual({});
  });

  it('coerces pagination and active filter query params', () => {
    const result = recurringQuerySchema.parse({
      isActive: 'false',
      page: '2',
      limit: '50',
    });

    expect(result).toEqual({
      isActive: false,
      page: 2,
      limit: 50,
    });
  });
});
