import { NotificationType, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/db';
import { notFound } from '../../utils/errors';

type NotificationTx = Prisma.TransactionClient | PrismaClient;

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

const preferenceFieldByType: Partial<Record<NotificationType, 'notifyBudgetAlerts' | 'notifyBillReminders' | 'notifyMonthlyReports'>> = {
  [NotificationType.BUDGET_ALERT]: 'notifyBudgetAlerts',
  [NotificationType.BILL_REMINDER]: 'notifyBillReminders',
  [NotificationType.MONTHLY_REPORT]: 'notifyMonthlyReports',
};

export const listNotifications = async (
  userId: string,
  query: { page: number; limit: number; unreadOnly?: boolean },
) => {
  const where: Prisma.NotificationWhereInput = {
    userId,
    readAt: query.unreadOnly ? null : undefined,
  };
  const skip = (query.page - 1) * query.limit;

  const [data, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    data,
    unreadCount,
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getUnreadCount = async (userId: string) => {
  const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });
  return { unreadCount };
};

export const createNotification = async (
  input: CreateNotificationInput,
  client: NotificationTx = prisma,
) => {
  const preferenceField = preferenceFieldByType[input.type];
  if (preferenceField) {
    const user = await client.user.findUnique({
      where: { id: input.userId },
      select: { [preferenceField]: true },
    });
    if (!user || !user[preferenceField]) return null;
  }

  return client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  });
};

export const markNotificationRead = async (userId: string, id: string) => {
  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) throw notFound('Notification not found');

  return prisma.notification.update({
    where: { id },
    data: { readAt: notification.readAt || new Date() },
  });
};

export const markAllNotificationsRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { message: `${result.count} notifications marked as read` };
};

export const clearReadNotifications = async (userId: string) => {
  const result = await prisma.notification.deleteMany({
    where: { userId, readAt: { not: null } },
  });
  return { message: `${result.count} read notifications cleared` };
};
