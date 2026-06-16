import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from '../../middleware/authenticate';
import { errorHandler } from '../../utils/errors';
import budgetGoalsRoutes from './budgetGoals.routes';

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  listBudgetGoals: vi.fn(),
  createBudgetGoal: vi.fn(),
  updateBudgetGoal: vi.fn(),
  deleteBudgetGoal: vi.fn(),
}));

vi.mock('../../utils/jwt', () => ({
  verifyAccessToken: mocks.verifyAccessToken,
}));

vi.mock('./budgetGoals.service', () => ({
  listBudgetGoals: mocks.listBudgetGoals,
  createBudgetGoal: mocks.createBudgetGoal,
  updateBudgetGoal: mocks.updateBudgetGoal,
  deleteBudgetGoal: mocks.deleteBudgetGoal,
}));

const buildTestApp = async () => {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.decorate('authenticate', authenticate);
  app.register(budgetGoalsRoutes, { prefix: '/api/budget-goals' });
  await app.ready();
  return app;
};

describe('budget goals routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serializes budget goals without requiring updatedAt', async () => {
    const app = await buildTestApp();
    mocks.verifyAccessToken.mockReturnValue({ userId: 'user_1', sessionId: 'session_1' });
    mocks.listBudgetGoals.mockResolvedValue([
      {
        id: 'goal_1',
        userId: 'user_1',
        categoryId: 'category_1',
        limitAmount: 500,
        month: 6,
        year: 2026,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        category: {
          id: 'category_1',
          userId: 'user_1',
          name: 'Education',
          color: '#a7f3d0',
          icon: 'book',
          isDefault: false,
        },
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/budget-goals?month=6&year=2026',
      headers: {
        authorization: 'Bearer access-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({
        id: 'goal_1',
        limitAmount: 500,
        month: 6,
        year: 2026,
      }),
    ]);
    expect(mocks.listBudgetGoals).toHaveBeenCalledWith('user_1', { month: 6, year: 2026 });

    await app.close();
  });
});
