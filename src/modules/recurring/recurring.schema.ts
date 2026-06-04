import { cronFrequency, TransactionType } from '@prisma/client';
import { z } from 'zod';

const booleanQuerySchema = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

export const createRecurringSchema = z.object({
  accountId: z.string().cuid(),
  title: z.string().min(1),
  amount: z.number().positive(),
  type: z.nativeEnum(TransactionType),
  categoryId: z.string().cuid(),
  frequency: z.nativeEnum(cronFrequency),
  nextDate: z.string().datetime(),
  notes: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateRecurringSchema = createRecurringSchema.partial();

export const recurringParamsSchema = z.object({
  id: z.string().cuid(),
});

export const recurringQuerySchema = z.object({
  type: z.nativeEnum(TransactionType).optional(),
  accountId: z.string().cuid().optional(),
  categoryId: z.string().cuid().optional(),
  isActive: booleanQuerySchema.optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
});

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;
export type RecurringParams = z.infer<typeof recurringParamsSchema>;
export type RecurringQuery = z.infer<typeof recurringQuerySchema>;
