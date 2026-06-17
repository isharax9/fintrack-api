import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from '../../middleware/authenticate';
import { errorHandler } from '../../utils/errors';
import notificationsRoutes from './notifications.routes';

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  listNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  clearReadNotifications: vi.fn(),
}));

vi.mock('../../utils/jwt', () => ({
  verifyAccessToken: mocks.verifyAccessToken,
}));

vi.mock('./notifications.service', () => ({
  listNotifications: mocks.listNotifications,
  getUnreadCount: mocks.getUnreadCount,
  markNotificationRead: mocks.markNotificationRead,
  markAllNotificationsRead: mocks.markAllNotificationsRead,
  clearReadNotifications: mocks.clearReadNotifications,
}));

const buildTestApp = async () => {
  const app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.decorate('authenticate', authenticate);
  app.register(notificationsRoutes, { prefix: '/api/notifications' });
  await app.ready();
  return app;
};

describe('notifications routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyAccessToken.mockReturnValue({ userId: 'user_1', sessionId: 'session_1' });
  });

  it('lists notifications for the authenticated user', async () => {
    const app = await buildTestApp();
    mocks.listNotifications.mockResolvedValue({
      data: [{
        id: 'notification_1',
        userId: 'user_1',
        type: 'IMPORT_COMPLETE',
        title: 'Import complete',
        message: '2 imported',
        createdAt: new Date('2026-06-17T00:00:00.000Z'),
      }],
      unreadCount: 1,
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/notifications?unreadOnly=true',
      headers: { authorization: 'Bearer access-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ unreadCount: 1, data: [{ id: 'notification_1' }] });
    expect(mocks.listNotifications).toHaveBeenCalledWith('user_1', { page: 1, limit: 10, unreadOnly: true });
    await app.close();
  });

  it('returns unread count', async () => {
    const app = await buildTestApp();
    mocks.getUnreadCount.mockResolvedValue({ unreadCount: 4 });

    const response = await app.inject({
      method: 'GET',
      url: '/api/notifications/unread-count',
      headers: { authorization: 'Bearer access-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ unreadCount: 4 });
    await app.close();
  });

  it('marks one notification as read', async () => {
    const app = await buildTestApp();
    mocks.markNotificationRead.mockResolvedValue({
      id: 'notification_1',
      userId: 'user_1',
      type: 'SYSTEM',
      title: 'Read',
      message: 'Done',
      readAt: new Date('2026-06-17T00:01:00.000Z'),
      createdAt: new Date('2026-06-17T00:00:00.000Z'),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/notifications/notification_1/read',
      headers: { authorization: 'Bearer access-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: 'notification_1', readAt: '2026-06-17T00:01:00.000Z' });
    expect(mocks.markNotificationRead).toHaveBeenCalledWith('user_1', 'notification_1');
    await app.close();
  });
});
