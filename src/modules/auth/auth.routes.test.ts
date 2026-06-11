import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from '../../middleware/authenticate';
import { errorHandler } from '../../utils/errors';
import authRoutes from './auth.routes';

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  logout: vi.fn(),
  logoutAll: vi.fn(),
}));

vi.mock('../../utils/jwt', () => ({
  verifyAccessToken: mocks.verifyAccessToken,
}));

vi.mock('./auth.service', () => ({
  logout: mocks.logout,
  logoutAll: mocks.logoutAll,
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  logoutOther: vi.fn(),
  listSessions: vi.fn(),
  generateOtp: vi.fn(),
  verifyOtp: vi.fn(),
  resetPassword: vi.fn(),
}));

const buildTestApp = async () => {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.decorate('authenticate', authenticate);
  app.register(authRoutes, { prefix: '/api/auth' });
  await app.ready();
  return app;
};

describe('auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('logs out the current session for an authenticated user', async () => {
    const app = await buildTestApp();
    mocks.verifyAccessToken.mockReturnValue({ userId: 'user_1', sessionId: 'session_1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        authorization: 'Bearer access-token',
        'user-agent': 'vitest',
        'x-request-id': 'req_logout',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Logged out' });
    expect(mocks.logout).toHaveBeenCalledWith('user_1', 'session_1', {
      requestId: 'req-1',
      ip: '127.0.0.1',
      userAgent: 'vitest',
    });

    await app.close();
  });

  it('logs out all sessions for an authenticated user', async () => {
    const app = await buildTestApp();
    mocks.verifyAccessToken.mockReturnValue({ userId: 'user_1', sessionId: 'session_1' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout-all',
      headers: {
        authorization: 'Bearer access-token',
        'user-agent': 'vitest',
        'x-request-id': 'req_logout_all',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'All sessions logged out' });
    expect(mocks.logoutAll).toHaveBeenCalledWith('user_1', {
      requestId: 'req-1',
      ip: '127.0.0.1',
      userAgent: 'vitest',
    });

    await app.close();
  });

  it('returns the centralized unauthorized error shape when auth is missing', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        'x-request-id': 'req_missing_auth',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized',
      },
      requestId: 'req-1',
    });
    expect(mocks.logout).not.toHaveBeenCalled();

    await app.close();
  });
});
