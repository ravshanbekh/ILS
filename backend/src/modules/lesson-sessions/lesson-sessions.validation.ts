import { z } from 'zod';

export const startSessionSchema = z.object({
  groupId: z.string().uuid('Noto\'g\'ri guruh ID'),
  topic: z.string().max(300).optional(),
});

export const gradeHomeworkSchema = z.object({
  studentId: z.string().uuid('Noto\'g\'ri o\'quvchi ID'),
  homework: z.enum(['toliq', 'qisman', 'bajarmagan', 'kelmadi'], {
    errorMap: () => ({ message: "homework: toliq, qisman, bajarmagan yoki kelmadi bo'lishi kerak" }),
  }),
  comment: z.string().max(500).optional(),
});

export const gradeActivitySchema = z.object({
  studentId: z.string().uuid('Noto\'g\'ri o\'quvchi ID'),
  activityScore: z.number().int().min(1).max(5),
});

export const gradeCoinSchema = z.object({
  studentId: z.string().uuid('Noto\'g\'ri o\'quvchi ID'),
  // Musbat son = qo'shish, manfiy son = ayirish (masalan -5)
  delta: z.number().int().refine((n) => n !== 0, 'delta nolga teng bo\'lmasligi kerak').refine((n) => Math.abs(n) <= 1000, "Bir martada 1000 coindan ortiq o'zgartirib bo'lmaydi"),
});

export const adminUnlockSchema = z.object({
  groupId: z.string().uuid('Noto\'g\'ri guruh ID'),
  note: z.string().min(1, "Izoh majburiy").max(500),
  date: z.string().datetime().optional(), // ISO — bo'lmasa bugungi kun
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type GradeHomeworkInput = z.infer<typeof gradeHomeworkSchema>;
export type GradeActivityInput = z.infer<typeof gradeActivitySchema>;
export type GradeCoinInput = z.infer<typeof gradeCoinSchema>;

export type AdminUnlockInput = z.infer<typeof adminUnlockSchema>;
