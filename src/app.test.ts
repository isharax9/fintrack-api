import { describe, expect, it } from 'vitest';

describe('app OpenAPI', () => {
  it('serves an OpenAPI document', async () => {
    process.env.ACCESS_TOKEN_SECRET = 'test_access_secret';
    process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret';
    process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
    process.env.REFRESH_TOKEN_EXPIRES_IN = '7d';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'test';
    process.env.SMTP_PASS = 'test';

    const { buildApp } = await import('./app');
    const app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/openapi.json',
    });

    expect(response.statusCode).toBe(200);
    const spec = response.json();

    expect(spec).toMatchObject({
      openapi: expect.stringMatching(/^3\./),
      info: {
        title: 'FinTrack API',
      },
    });
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
    const transactionsPath = spec.paths['/api/transactions'] ?? spec.paths['/api/transactions/'];
    expect(spec.paths['/api/auth/login'].post.tags).toContain('Auth');
    expect(transactionsPath.get.security).toEqual([{ bearerAuth: [] }]);

    await app.close();
  });
});
