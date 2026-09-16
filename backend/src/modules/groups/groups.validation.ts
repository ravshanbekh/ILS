import { z } from 'zod';


// Demo day va imtihon jadvali shu uchta maydondan hisoblanadi.
// createdAt ishlatilmaydi: guruh tizimga kech kiritilishi yoki oldindan
// ochib qo'yilishi mumkin.
const scheduleFields = {
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Sana YYYY-MM-DD ko'rinishida bo'lsin")
    .optional()
    .nullable(),
  durationMonths: z
    .number()
    .int()
    .min(1, 'Kurs kamida 1 oy')
    .max(36, 'Kurs 36 oydan oshmasin')
    .optional()
    .nullable(),
  lessonDayType: z.enum(['juft', 'toq', 'har_kuni']).optional().nullable(),
};

export const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, 'Guruh nomi kerak')
    .max(50, 'Guruh nomi 50 ta belgidan oshmasin'),
  teacherId: z.string().uuid('Noto\'g\'ri o\'qituvchi ID').optional().nullable(),
  ...scheduleFields,
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  teacherId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
  ...scheduleFields,
});

export const addStudentSchema = z.object({
  studentId: z.string().uuid('Noto\'g\'ri o\'quvchi ID'),
});

export const addStudentsSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'Kamida 1 ta o\'quvchi kerak'),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
