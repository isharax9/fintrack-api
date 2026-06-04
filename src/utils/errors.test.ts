import { describe, expect, it } from 'vitest';
import { badRequest, formatErrorResponse } from './errors';
import { z } from 'zod';

describe('error formatting', () => {
  it('formats app errors with code and request id', () => {
    const result = formatErrorResponse(badRequest('Invalid amount'), 'req-1');

    expect(result).toEqual({
      statusCode: 400,
      body: {
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid amount',
          details: undefined,
        },
        requestId: 'req-1',
      },
    });
  });

  it('formats zod validation errors consistently', () => {
    const parsed = z.object({ amount: z.number().positive() }).safeParse({ amount: -1 });
    if (parsed.success) throw new Error('Expected validation failure');

    const result = formatErrorResponse(parsed.error, 'req-2');

    expect(result.statusCode).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_ERROR');
    expect(result.body.requestId).toBe('req-2');
  });
});
