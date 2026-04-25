import { z } from 'zod';

const ideaOverridesDto = z.object({
  date: z.iso.date('date must be a valid ISO date, e.g. 2026-04-28').optional(),
  dayOfWeek: z.string().min(3).max(20).optional(),
  title: z.string().min(1).max(180).optional(),
  description: z.string().min(1).max(2500).optional(),
  suggestedCaption: z.string().min(1).max(4000).optional(),
  hashtags: z.array(z.string().min(1).max(64)).max(30).optional(),
  contentTheme: z.string().min(1).max(120).optional(),
  postType: z.enum(['image', 'carousel']).optional(),
  platform: z.enum(['instagram', 'facebook', 'both']).optional(),
  bestTimeToPost: z.string().min(1).max(80).optional(),
  justification: z.string().min(1).max(2500).optional(),
});

export const generateContentForIdeaBodyDto = z.object({
  businessContextId: z.string().min(1, 'businessContextId is required'),
  overrides: ideaOverridesDto.optional(),
  referenceImageUrls: z.array(z.url('Each reference image must be a valid URL')).max(8).optional(),
});

export type GenerateContentForIdeaBodyDto = z.infer<typeof generateContentForIdeaBodyDto>;
