import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string().min(1),
});

export const updateTagSchema = createTagSchema.partial();

export const tagParamsSchema = z.object({
  id: z.string().cuid(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type TagParams = z.infer<typeof tagParamsSchema>;
