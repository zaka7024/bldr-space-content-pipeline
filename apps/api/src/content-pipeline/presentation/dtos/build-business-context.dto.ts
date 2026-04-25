import { z } from 'zod';

export const buildBusinessContextDto = z.object({
  businessName: z.string().min(1, 'businessName is required'),
  websiteUrl:   z.url('websiteUrl must be a valid URL'),
  instagramUrl: z.url('instagramUrl must be a valid URL').optional(),
  facebookUrl:  z.url('facebookUrl must be a valid URL').optional(),
  postsLimit:   z.int().min(1).max(200).optional(),
});

export type BuildBusinessContextDto = z.infer<typeof buildBusinessContextDto>;
