import { z } from 'zod';

export const createNormativeSchema = z.object({
  taskNumber: z.number().int().positive('Task raqami musbat bo\'lishi kerak'),
  title: z.string().min(1, 'Sarlavha kerak').max(255),
  description: z.string().optional().nullable(),
  timeLimit: z.number().int().positive().optional().nullable(),
  url: z.string().url('Noto\'g\'ri URL format').optional().nullable(),
  maxScore: z.number().int().positive().default(40),
  categoryId: z.string().uuid().optional().nullable(),
});

export const updateNormativeSchema = z.object({
  taskNumber: z.number().int().positive().optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  timeLimit: z.number().int().positive().optional().nullable(),
  url: z.string().url().optional().nullable(),
  maxScore: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  categoryId: z.string().uuid().optional().nullable(),
});

export const assignNormativeSchema = z.object({
  normativeIds: z.array(z.string().uuid()).min(1, 'Kamida 1 ta normativ kerak'),
});

export type CreateNormativeInput = z.infer<typeof createNormativeSchema>;
export type UpdateNormativeInput = z.infer<typeof updateNormativeSchema>;
