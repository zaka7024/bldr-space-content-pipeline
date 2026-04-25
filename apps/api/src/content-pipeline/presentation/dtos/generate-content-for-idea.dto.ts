import { z } from 'zod';

export const generateContentForIdeaBodyDto = z.object({
  businessContextId: z.string().min(1, 'businessContextId is required'),
});

export type GenerateContentForIdeaBodyDto = z.infer<typeof generateContentForIdeaBodyDto>;
