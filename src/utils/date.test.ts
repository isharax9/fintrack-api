import { describe, expect, it } from 'vitest';
import { getMonthDateRangeUTC } from './date';

describe('date utils', () => {
  it('computes exact UTC month boundaries for June 2026', () => {
    const { startDate, endDate } = getMonthDateRangeUTC(2026, 6);
    expect(startDate.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(endDate.toISOString()).toBe('2026-06-30T23:59:59.999Z');
  });

  it('computes leap year February boundaries correctly', () => {
    const { startDate, endDate } = getMonthDateRangeUTC(2024, 2);
    expect(startDate.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    expect(endDate.toISOString()).toBe('2024-02-29T23:59:59.999Z');
  });
});
