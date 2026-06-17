import { NotificationType } from '@prisma/client';
import { z } from 'zod';

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  unreadOnly: z.coerce.boolean().optional(),
});

export const notificationTypeSchema = z.nativeEnum(NotificationType);

export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
