import { z } from 'zod';

export const reportQuerySchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2000).max(2100),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
