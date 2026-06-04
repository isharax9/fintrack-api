import { describe, expect, it } from 'vitest';
import { auditQuerySchema } from './audit.schema';

describe('audit schemas', () => {
  it('applies pagination defaults', () => {
    expect(auditQuerySchema.parse({})).toMatchObject({
      page: 1,
      limit: 25,
    });
  });

  it('coerces pagination query strings', () => {
    expect(auditQuerySchema.parse({ page: '2', limit: '50' })).toMatchObject({
      page: 2,
      limit: 50,
    });
  });
});
