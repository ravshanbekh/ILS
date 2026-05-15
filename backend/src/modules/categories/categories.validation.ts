import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2, "Kategoriya nomi kamida 2 ta belgi bo'lishi kerak"),
  description: z.string().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
