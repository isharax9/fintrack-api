import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  currency: z.string().length(3).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const updateNotificationPreferencesSchema = z.object({
  budgetAlerts: z.boolean().optional(),
  monthlyReports: z.boolean().optional(),
  billReminders: z.boolean().optional(),
});

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
