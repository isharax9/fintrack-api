import { z } from 'zod';

export const importQuerySchema = z.object({
  dryRun: z.coerce.boolean().default(true),
});

export type ImportQuery = z.infer<typeof importQuerySchema>;

