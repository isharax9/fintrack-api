import { z } from 'zod';

export const createSavingsGoalSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.number().positive().optional(),
  deadline: z.string().datetime().optional(),
});

export const updateSavingsGoalSchema = createSavingsGoalSchema.partial();

export const allocateFundsSchema = z.object({
  amount: z.number().positive(),
});

export const savingsParamsSchema = z.object({
  id: z.string().cuid(),
});

export type CreateSavingsGoalInput = z.infer<typeof createSavingsGoalSchema>;
export type UpdateSavingsGoalInput = z.infer<typeof updateSavingsGoalSchema>;
export type AllocateFundsInput = z.infer<typeof allocateFundsSchema>;
export type SavingsParams = z.infer<typeof savingsParamsSchema>;
