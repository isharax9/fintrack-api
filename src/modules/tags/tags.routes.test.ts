import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from '../../middleware/authenticate';
import { errorHandler } from '../../utils/errors';
import tagsRoutes from './tags.routes';

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  listTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));

vi.mock('../../utils/jwt', () => ({
  verifyAccessToken: mocks.verifyAccessToken,
}));

vi.mock('./tags.service', () => ({
  listTags: mocks.listTags,
  createTag: mocks.createTag,
  updateTag: mocks.updateTag,
  deleteTag: mocks.deleteTag,
}));

const buildTestApp = async () => {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.decorate('authenticate', authenticate);
  app.register(tagsRoutes, { prefix: '/api/tags' });
  await app.ready();
  return app;
};

describe('tags routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyAccessToken.mockReturnValue({ userId: 'c123456789012345678901234', sessionId: 'session_1' });
  });

  it('lists tags without requiring timestamp fields', async () => {
    const app = await buildTestApp();
    mocks.listTags.mockResolvedValue([
      {
        id: 'c223456789012345678901234',
        userId: 'c123456789012345678901234',
        name: 'subscriptions',
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/tags',
      headers: { authorization: 'Bearer access-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: 'c223456789012345678901234',
        userId: 'c123456789012345678901234',
        name: 'subscriptions',
      },
    ]);
    expect(mocks.listTags).toHaveBeenCalledWith('c123456789012345678901234');

    await app.close();
  });

  it('trims tag names before creating a tag', async () => {
    const app = await buildTestApp();
    mocks.createTag.mockResolvedValue({
      id: 'c223456789012345678901234',
      userId: 'c123456789012345678901234',
      name: 'subscriptions',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/tags',
      headers: { authorization: 'Bearer access-token' },
      payload: { name: '  subscriptions  ' },
    });

    expect(response.statusCode).toBe(201);
    expect(mocks.createTag).toHaveBeenCalledWith(
      'c123456789012345678901234',
      { name: 'subscriptions' },
      expect.objectContaining({ requestId: 'req-1' }),
    );

    await app.close();
  });
});
