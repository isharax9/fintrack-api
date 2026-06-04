import { describe, expect, it } from 'vitest';

describe('jwt utilities', () => {
  it('preserves the session id in access tokens', async () => {
    process.env.ACCESS_TOKEN_SECRET = 'test_access_secret';
    process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret';
    process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
    process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'test';
    process.env.SMTP_PASS = 'test';

    const { signAccessToken, verifyAccessToken } = await import('./jwt');

    const token = signAccessToken({
      userId: 'user_123',
      sessionId: 'session_123',
    });

    expect(verifyAccessToken(token)).toMatchObject({
      userId: 'user_123',
      sessionId: 'session_123',
    });
  });
});
