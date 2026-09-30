import { z } from 'zod';

export const createBudgetGoalSchema = z.object({
  categoryId: z.string().cuid(),
  limitAmount: z.number().positive(),
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
});

export const updateBudgetGoalSchema = z.object({
  limitAmount: z.number().positive(),
});

export const budgetGoalQuerySchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
});

export const budgetGoalParamsSchema = z.object({
  id: z.string().cuid(),
});

export const transferEnvelopeSchema = z.object({
  fromCategoryId: z.string(),
  toCategoryId: z.string(),
  amount: z.number().positive(),
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
  note: z.string().max(200).optional(),
});

export const fillEnvelopesSchema = z.object({
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
  mode: z.enum(['set', 'add']).default('set'),
  fills: z.array(
    z.object({
      categoryId: z.string(),
      amount: z.number().nonnegative(),
    }),
  ).min(1),
});

export type CreateBudgetGoalInput = z.infer<typeof createBudgetGoalSchema>;
export type UpdateBudgetGoalInput = z.infer<typeof updateBudgetGoalSchema>;
export type BudgetGoalQuery = z.infer<typeof budgetGoalQuerySchema>;
export type BudgetGoalParams = z.infer<typeof budgetGoalParamsSchema>;
export type TransferEnvelopeInput = z.infer<typeof transferEnvelopeSchema>;
export type FillEnvelopesInput = z.infer<typeof fillEnvelopesSchema>;

