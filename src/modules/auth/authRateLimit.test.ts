import { describe, expect, it } from 'vitest';
import { authRateLimitInternals, forgotPasswordRateLimit, loginRateLimit } from './authRateLimit';

describe('auth rate limit config', () => {
  it('normalizes email addresses before generating keys', () => {
    expect(authRateLimitInternals.normalizeEmail('  USER@Example.com  ')).toBe('user@example.com');
    expect(authRateLimitInternals.normalizeEmail(undefined)).toBe('anonymous');
    expect(authRateLimitInternals.normalizeEmail('')).toBe('anonymous');
  });

  it('keys login attempts by both ip and normalized email', () => {
    const key = loginRateLimit.keyGenerator({
      ip: '127.0.0.1',
      body: { email: ' User@Example.com ' },
    } as any);

    expect(key).toBe('login:127.0.0.1:user@example.com');
  });

  it('keys forgot-password attempts by both ip and normalized email', () => {
    const key = forgotPasswordRateLimit.keyGenerator({
      ip: '127.0.0.1',
      body: { email: ' User@Example.com ' },
    } as any);

    expect(key).toBe('forgot-password:127.0.0.1:user@example.com');
  });
});
