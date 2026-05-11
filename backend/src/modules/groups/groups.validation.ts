import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, 'Guruh nomi kerak')
    .max(50, 'Guruh nomi 50 ta belgidan oshmasin'),
  teacherId: z.string().uuid('Noto\'g\'ri o\'qituvchi ID').optional().nullable(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  teacherId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const addStudentSchema = z.object({
  studentId: z.string().uuid('Noto\'g\'ri o\'quvchi ID'),
});

export const addStudentsSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'Kamida 1 ta o\'quvchi kerak'),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
