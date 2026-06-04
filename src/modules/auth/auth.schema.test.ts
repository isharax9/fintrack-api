import { describe, expect, it } from 'vitest';
import { registerSchema, resetPasswordSchema } from './auth.schema';

describe('auth schemas', () => {
  it('requires stronger registration passwords', () => {
    const result = registerSchema.safeParse({
      name: 'Test User',
      email: 'test@example.com',
      password: '1234567',
    });

    expect(result.success).toBe(false);
  });

  it('accepts reset passwords with at least 8 characters', () => {
    const result = resetPasswordSchema.safeParse({
      resetToken: 'token',
      newPassword: '12345678',
    });

    expect(result.success).toBe(true);
  });
});
