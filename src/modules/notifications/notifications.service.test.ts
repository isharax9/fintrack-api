import { NotificationType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../config/db', () => ({ prisma: mocks.prisma }));

describe('notifications service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists notifications with unread count and pagination metadata', async () => {
    const service = await import('./notifications.service');
    mocks.prisma.notification.findMany.mockResolvedValue([{ id: 'notification_1' }]);
    mocks.prisma.notification.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);

    const result = await service.listNotifications('user_1', { page: 2, limit: 10 });

    expect(result).toEqual({
      data: [{ id: 'notification_1' }],
      unreadCount: 3,
      meta: { total: 1, page: 2, limit: 10, totalPages: 1 },
    });
    expect(mocks.prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user_1', readAt: undefined },
      skip: 10,
      take: 10,
    }));
  });

  it('does not create preference-gated notifications when disabled', async () => {
    const service = await import('./notifications.service');
    mocks.prisma.user.findUnique.mockResolvedValue({ notifyBudgetAlerts: false });

    const result = await service.createNotification({
      userId: 'user_1',
      type: NotificationType.BUDGET_ALERT,
      title: 'Budget alert',
      message: 'Budget pressure',
    });

    expect(result).toBeNull();
    expect(mocks.prisma.notification.create).not.toHaveBeenCalled();
  });

  it('creates ungated import notifications', async () => {
    const service = await import('./notifications.service');
    mocks.prisma.notification.create.mockResolvedValue({ id: 'notification_1' });

    const result = await service.createNotification({
      userId: 'user_1',
      type: NotificationType.IMPORT_COMPLETE,
      title: 'Import complete',
      message: '2 rows imported',
    });

    expect(result).toEqual({ id: 'notification_1' });
    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('prevents marking another user notification as read', async () => {
    const service = await import('./notifications.service');
    mocks.prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.markNotificationRead('user_1', 'notification_2')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
    expect(mocks.prisma.notification.update).not.toHaveBeenCalled();
  });

  it('marks all unread notifications as read for one user', async () => {
    const service = await import('./notifications.service');
    mocks.prisma.notification.updateMany.mockResolvedValue({ count: 2 });

    await expect(service.markAllNotificationsRead('user_1')).resolves.toEqual({
      message: '2 notifications marked as read',
    });
    expect(mocks.prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
