import { z } from 'zod';

export const createTransferSchema = z.object({
  fromAccountId: z.string().cuid(),
  toAccountId: z.string().cuid(),
  amount: z.number().positive(),
  date: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const transferParamsSchema = z.object({
  id: z.string().cuid(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type TransferParams = z.infer<typeof transferParamsSchema>;
