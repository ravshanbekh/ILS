import { z } from 'zod';

const ALL_ROLES = [
  'admin', 'teacher', 'student',
  'filial_rahbari', 'assistant', 'moliya_rahbari', 'kassir',
  'administrator', 'nazoratchi', 'hr_rahbari', 'sotuv_operatori', 'farrosh',
  'robototexnika_ustoz', 'call_operatori',
] as const;

export const createUserSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Ism kamida 2 ta belgi bo\'lishi kerak')
    .max(100, 'Ism 100 ta belgidan oshmasligi kerak'),
  login: z
    .string()
    .min(3, 'Login kamida 3 ta belgi')
    .max(50, 'Login 50 ta belgidan oshmasin')
    .regex(/^[a-zA-Z0-9_.]+$/, 'Login faqat harf, raqam, nuqta va _ bo\'lishi mumkin'),
  password: z
    .string()
    .min(3, 'Parol kamida 3 ta belgi'),
  role: z.enum(ALL_ROLES, {
    errorMap: () => ({ message: 'Noto\'g\'ri rol tanlandi' }),
  }),
  avatarUrl: z.string().url().optional().nullable(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  login: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.]+$/).optional(),
  password: z.string().min(3).optional(),
  role: z.enum(ALL_ROLES).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

