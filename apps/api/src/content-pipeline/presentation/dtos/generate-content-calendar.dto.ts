import { z } from 'zod';

export const generateContentCalendarDto = z.object({
  businessContextId: z.string().min(1, 'businessContextId is required'),
  daysRange:         z.int().min(1).max(90).optional(),
  startDate:         z.iso.date('startDate must be a valid ISO date, e.g. 2026-04-25').optional(),
});

export type GenerateContentCalendarDto = z.infer<typeof generateContentCalendarDto>;
