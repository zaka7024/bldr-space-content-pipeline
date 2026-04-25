import { tool } from 'ai';
import { z } from 'zod';
import FirecrawlApp from '@mendable/firecrawl-js';
import type { BrandingProfile } from '@mendable/firecrawl-js';

export type { BrandingProfile };

export const scrapeBrand = tool({
  description:
    'Extract the visual brand identity of a website (colors, fonts, logo, typography, spacing) using Firecrawl.',
  inputSchema: z.object({
    websiteUrl: z.string().describe('Full URL of the website to extract branding from'),
  }),
  execute: async ({ websiteUrl }): Promise<BrandingProfile> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error('FIRECRAWL_API_KEY is not set');

    const firecrawl = new FirecrawlApp({ apiKey });

    const result = await firecrawl.scrape(websiteUrl, {
      formats: ['branding'],
    });

    return result.branding ?? {};
  },
});
