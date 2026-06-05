import { describe, expect, it } from 'vitest';

describe('app OpenAPI', () => {
  const buildTestApp = async () => {
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
    return app;
  };

  it('serves an OpenAPI document', async () => {
    const app = await buildTestApp();
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

  it('documents every public API route with request and response contracts', async () => {
    const app = await buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    const spec = response.json();

    const path = (url: string) => spec.paths[url] ?? spec.paths[`${url}/`];
    const expectedRoutes = [
      ['/health', 'get'],
      ['/ready', 'get'],
      ['/api/auth/register', 'post'],
      ['/api/auth/login', 'post'],
      ['/api/auth/refresh', 'post'],
      ['/api/auth/logout', 'post'],
      ['/api/auth/logout-all', 'post'],
      ['/api/auth/forgot-password', 'post'],
      ['/api/auth/verify-otp', 'post'],
      ['/api/auth/reset-password', 'post'],
      ['/api/user/me', 'get'],
      ['/api/user/me', 'put'],
      ['/api/user/me', 'delete'],
      ['/api/accounts', 'get'],
      ['/api/accounts', 'post'],
      ['/api/accounts/{id}', 'put'],
      ['/api/accounts/{id}', 'delete'],
      ['/api/categories', 'get'],
      ['/api/categories', 'post'],
      ['/api/categories/{id}', 'put'],
      ['/api/categories/{id}', 'delete'],
      ['/api/tags', 'get'],
      ['/api/tags', 'post'],
      ['/api/tags/{id}', 'put'],
      ['/api/tags/{id}', 'delete'],
      ['/api/transactions', 'get'],
      ['/api/transactions', 'post'],
      ['/api/transactions/{id}', 'get'],
      ['/api/transactions/{id}', 'put'],
      ['/api/transactions/{id}', 'delete'],
      ['/api/transfers', 'get'],
      ['/api/transfers', 'post'],
      ['/api/budget-goals', 'get'],
      ['/api/budget-goals', 'post'],
      ['/api/budget-goals/{id}', 'put'],
      ['/api/budget-goals/{id}', 'delete'],
      ['/api/reports/summary', 'get'],
      ['/api/reports/by-category', 'get'],
      ['/api/reports/trend', 'get'],
      ['/api/savings/bucket', 'get'],
      ['/api/savings/goals', 'get'],
      ['/api/savings/goals', 'post'],
      ['/api/savings/goals/{id}', 'put'],
      ['/api/savings/goals/{id}/allocate', 'post'],
      ['/api/savings/goals/{id}', 'delete'],
      ['/api/exports/transactions/pdf', 'get'],
      ['/api/exports/reports/pdf', 'get'],
      ['/api/recurring', 'get'],
      ['/api/recurring', 'post'],
      ['/api/recurring/{id}', 'get'],
      ['/api/recurring/{id}', 'put'],
      ['/api/recurring/{id}', 'delete'],
      ['/api/audit', 'get'],
    ] as const;

    for (const [url, method] of expectedRoutes) {
      const operation = path(url)?.[method];
      expect(operation, `${method.toUpperCase()} ${url}`).toBeTruthy();
      expect(operation.responses, `${method.toUpperCase()} ${url} responses`).toBeTruthy();
      if (!url.startsWith('/health') && !url.startsWith('/ready') && !url.startsWith('/api/auth')) {
        expect(operation.security, `${method.toUpperCase()} ${url} security`).toEqual([{ bearerAuth: [] }]);
      }
    }

    expect(path('/api/accounts').post.requestBody.content['application/json'].schema.required).toEqual(['name', 'type']);
    expect(path('/api/transactions').get.parameters.map((param: { name: string }) => param.name)).toEqual(
      expect.arrayContaining(['type', 'categoryId', 'accountId', 'from', 'to', 'page', 'limit']),
    );
    expect(path('/api/transactions').get.responses['200'].content['application/json'].schema.properties).toHaveProperty('data');
    expect(path('/ready').get.responses).toHaveProperty('503');

    await app.close();
  });

  it('serves liveness without checking external dependencies', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'contract-test-request' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      requestId: 'contract-test-request',
    });

    await app.close();
  });
});
