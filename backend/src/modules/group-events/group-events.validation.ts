import { z } from 'zod';

export const createEventSchema = z.object({
  groupId: z.string().uuid('Noto\'g\'ri guruh ID'),
  title: z.string().min(1, 'Sarlavha kerak').max(200),
  eventAt: z.string().datetime({ message: 'eventAt ISO formatda bo\'lishi kerak' }),
  place: z.string().max(300).optional(),
  description: z.string().max(1000).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
