import { z } from 'zod';

export const eventFeedbackFiltersSchema = z.object({
  groupId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type EventFeedbackFilters = z.infer<typeof eventFeedbackFiltersSchema>;
