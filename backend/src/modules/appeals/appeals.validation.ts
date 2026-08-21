import { z } from 'zod';

export const replyAppealSchema = z.object({
  reply: z.string().min(1, "Javob matni bo'sh bo'lmasin").max(2000),
});

export type ReplyAppealInput = z.infer<typeof replyAppealSchema>;
