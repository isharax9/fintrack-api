import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from '../../middleware/authenticate';
import { notFound } from '../../utils/errors';
import { errorHandler } from '../../utils/errors';
import transactionsRoutes from './transactions.routes';

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  listTransactions: vi.fn(),
  createTransaction: vi.fn(),
  getTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
}));

vi.mock('../../utils/jwt', () => ({
  verifyAccessToken: mocks.verifyAccessToken,
}));

vi.mock('./transactions.service', () => ({
  listTransactions: mocks.listTransactions,
  createTransaction: mocks.createTransaction,
  getTransaction: mocks.getTransaction,
  updateTransaction: mocks.updateTransaction,
  deleteTransaction: mocks.deleteTransaction,
}));

const validCuid = 'c123456789012345678901234';

const buildTestApp = async () => {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.decorate('authenticate', authenticate);
  app.register(transactionsRoutes, { prefix: '/api/transactions' });
  await app.ready();
  return app;
};

describe('transactions routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the centralized unauthorized error shape when auth is missing', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/transactions',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      },
      requestId: 'req-1',
    });

    await app.close();
  });

  it('returns the centralized validation error shape for invalid request bodies', async () => {
    const app = await buildTestApp();
    mocks.verifyAccessToken.mockReturnValue({ userId: 'user_1', sessionId: 'session_1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/transactions',
      headers: {
        authorization: 'Bearer access-token',
      },
      payload: {
        title: '',
        amount: -50,
        type: 'EXPENSE',
        categoryId: validCuid,
        date: 'not-a-date',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: expect.any(Array),
      },
      requestId: 'req-1',
    });
    expect(mocks.createTransaction).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns the centralized not-found error shape when the service throws an AppError', async () => {
    const app = await buildTestApp();
    mocks.verifyAccessToken.mockReturnValue({ userId: 'user_1', sessionId: 'session_1' });
    mocks.getTransaction.mockRejectedValue(notFound('Transaction not found'));

    const response = await app.inject({
      method: 'GET',
      url: `/api/transactions/${validCuid}`,
      headers: {
        authorization: 'Bearer access-token',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Transaction not found',
      },
      requestId: 'req-1',
    });

    await app.close();
  });
});
