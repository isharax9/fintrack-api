import { z } from 'zod';

export const auditQuerySchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;
