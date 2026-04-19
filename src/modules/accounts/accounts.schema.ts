import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['BANK', 'CASH', 'CREDIT', 'WALLET']),
  balance: z.number().optional().default(0),
});

export const updateAccountSchema = createAccountSchema.partial();

export const accountParamsSchema = z.object({
  id: z.string().cuid(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type AccountParams = z.infer<typeof accountParamsSchema>;
