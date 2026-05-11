import { z } from 'zod';

export const loginSchema = z.object({
  login: z
    .string()
    .min(3, 'Login kamida 3 ta belgi bo\'lishi kerak')
    .max(50, 'Login 50 ta belgidan oshmasligi kerak'),
  password: z
    .string()
    .min(3, 'Parol kamida 3 ta belgi bo\'lishi kerak'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token talab qilinadi'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
