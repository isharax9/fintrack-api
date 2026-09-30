import { NotificationType, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/db';
import { notFound } from '../../utils/errors';
import {
  sendBudgetAlertEmail,
  sendBillReminderEmail,
  sendSavingsMilestoneEmail,
} from '../../utils/email';

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

const preferenceFieldByType: Partial<
  Record<NotificationType, 'notifyBudgetAlerts' | 'notifyBillReminders' | 'notifyMonthlyReports'>
> = {
  [NotificationType.BUDGET_ALERT]: 'notifyBudgetAlerts',
  [NotificationType.BILL_REMINDER]: 'notifyBillReminders',
  [NotificationType.MONTHLY_REPORT]: 'notifyMonthlyReports',
};

// ─── Email dispatch (fire-and-forget, non-blocking) ───────────────────────────
const dispatchNotificationEmail = (
  user: { email: string; name: string },
  type: NotificationType,
  metadata: Prisma.JsonValue,
) => {
  const meta = (metadata as Record<string, unknown>) ?? {};

  const handle = async () => {
    try {
      if (type === NotificationType.BUDGET_ALERT) {
        await sendBudgetAlertEmail({
          to: user.email,
          userName: user.name,
          categoryName: String(meta.categoryName ?? 'Budget'),
          spentAmount: Number(meta.spentAmount ?? 0),
          limitAmount: Number(meta.limitAmount ?? 0),
          percent: Number(meta.percent ?? 0),
        });
      } else if (type === NotificationType.BILL_REMINDER) {
        await sendBillReminderEmail({
          to: user.email,
          userName: user.name,
          bills: [
            {
              title: String(meta.title ?? 'Upcoming bill'),
              amount: Number(meta.amount ?? 0),
              dueDate: String(meta.nextDate ?? '').slice(0, 10),
              frequency: String(meta.frequency ?? ''),
            },
          ],
        });
      } else if (type === NotificationType.SAVINGS_MILESTONE) {
        await sendSavingsMilestoneEmail({
          to: user.email,
          userName: user.name,
          goalName: String(meta.goalName ?? 'Savings Goal'),
          currentAmount: Number(meta.currentAmount ?? 0),
          targetAmount: meta.targetAmount != null ? Number(meta.targetAmount) : undefined,
          milestonePercent: Number(meta.milestonePercent ?? 0),
        });
      }
    } catch (err) {
      // Email failures must never crash the main flow
      console.error(`[email] Failed to send ${type} email to ${user.email}:`, err);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  handle();
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────
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

  // Look up user to check notification preference and get email/name for email dispatch
  const userSelectFields = {
    email: true,
    name: true,
    ...(preferenceField ? { [preferenceField]: true } : {}),
  } as const;

  const user = await client.user.findUnique({
    where: { id: input.userId },
    select: userSelectFields,
  });

  // Respect per-type preference gate
  if (preferenceField && (!user || !user[preferenceField as keyof typeof user])) return null;
  if (!user) return null;

  const notification = await client.notification.create({
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

  // Fire-and-forget email for actionable notification types
  const emailEligibleTypes = new Set<NotificationType>([
    NotificationType.BUDGET_ALERT,
    NotificationType.BILL_REMINDER,
    NotificationType.SAVINGS_MILESTONE,
  ]);

  if (emailEligibleTypes.has(input.type)) {
    dispatchNotificationEmail(
      { email: user.email, name: user.name },
      input.type,
      (input.metadata as Prisma.JsonValue) ?? null,
    );
  }

  return notification;
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
