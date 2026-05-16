import { z } from 'zod';

export const createSubmissionSchema = z.object({
  normativeId: z.string().uuid('Noto\'g\'ri normativ ID'),
  groupId: z.string().uuid('Noto\'g\'ri guruh ID').optional().nullable(),
  youtubeUrl: z
    .string()
    .min(1, 'YouTube havola kerak')
    .regex(
      /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)[\w\-]+(?:\S*)?$/,
      'Faqat YouTube havola qabul qilinadi'
    ),
});

export const checkSubmissionSchema = z.object({
  result: z.enum(['green', 'blue', 'red'], {
    errorMap: () => ({ message: 'Natija: green, blue yoki red bo\'lishi kerak' }),
  }),
  comment: z.string().optional().nullable(),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type CheckSubmissionInput = z.infer<typeof checkSubmissionSchema>;
