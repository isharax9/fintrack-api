import { z } from 'zod';
import { TransferStatus } from '@prisma/client';

export const createTransferSchema = z.object({
  fromAccountId: z.string().cuid(),
  toAccountId: z.string().cuid(),
  amount: z.number().positive(),
  date: z.string().datetime().optional(),
  notes: z.string().optional(),
}).refine((data) => data.fromAccountId !== data.toAccountId, {
  message: 'Transfer accounts must be different',
  path: ['toAccountId'],
});

export const transferParamsSchema = z.object({
  id: z.string().cuid(),
});

export const transferQuerySchema = z.object({
  accountId: z.string().cuid().optional(),
  fromAccountId: z.string().cuid().optional(),
  toAccountId: z.string().cuid().optional(),
  status: z.nativeEnum(TransferStatus).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
});

export const reverseTransferSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type TransferQuery = z.infer<typeof transferQuerySchema>;
export type TransferParams = z.infer<typeof transferParamsSchema>;
export type ReverseTransferInput = z.infer<typeof reverseTransferSchema>;
