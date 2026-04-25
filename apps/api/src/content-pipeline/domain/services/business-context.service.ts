import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { Exa } from 'exa-js';
import axios from 'axios';
import https from 'node:https';
import { scrapeInstagram, scrapeFacebook, scrapeBrand } from '../tools/index.js';
import { BusinessContextModel } from '../models/business-context.model.js';
import type { InstagramAggregatedResult, FacebookScraperResult } from '../tools/types.js';
import type { BrandingProfile } from '../tools/scrape-brand.js';

// ── Types ─────────────────────────────────────────────────────────

export interface BuildBusinessContextInput {
  userId:        string;
  businessName:  string;
  websiteUrl:    string;
  instagramUrl?: string;
  facebookUrl?:  string;
  postsLimit?:   number;
}

interface WebsitePage {
  title:   string;
  url:     string;
  content: string;
}

const CERT_ERROR_CODES = new Set([
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
]);

function getCauseCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== 'object') return undefined;
  const code = (cause as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function canUseInsecureTlsFallback(): boolean {
  if (process.env.EXA_ALLOW_INSECURE_TLS === 'true') {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHtmlTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return (match?.[1] ?? '').replace(/\s+/g, ' ').trim();
}

async function fetchWebsiteContentDirect(url: string): Promise<WebsitePage[]> {
  const response = await axios.get<string>(url, {
    responseType: 'text',
    timeout: 20_000,
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BLDR/1.0)' },
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  });

  const html = typeof response.data === 'string' ? response.data : String(response.data ?? '');
  const title = extractHtmlTitle(html) || url;
  const content = htmlToText(html).slice(0, 8000);

  return [{ title, url, content }];
}

// ── Brand voice schema ────────────────────────────────────────────

const brandVoiceSchema = z.object({
  tone: z
    .string()
    .describe('Overall tone of the brand, e.g. professional, warm, inspirational'),
  style: z
    .string()
    .describe('Writing style, e.g. formal, casual, narrative, conversational'),
  keywords: z
    .array(z.string())
    .describe('Key terms and phrases the brand uses frequently'),
  targetAudience: z
    .string()
    .describe('Primary target audience description'),
  uniqueValueProposition: z
    .string()
    .describe('What makes this brand unique compared to competitors'),
  contentThemes: z
    .array(z.string())
    .describe('Recurring themes found across the brand content'),
  writingStyle: z
    .string()
    .describe('Specific writing characteristics: sentence length, vocabulary level, etc.'),
  examplePhrases: z
    .array(z.string())
    .describe('Representative phrases that capture the brand voice'),
});

// ── Step 1: Website content ───────────────────────────────────────

async function fetchWebsiteContent(url: string): Promise<WebsitePage[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error('EXA_API_KEY is not set');

  const exa = new Exa(apiKey);
  try {
    // Fetch the page content directly by URL
    const result = await (exa as any).getContents([url], { text: { maxCharacters: 8000 } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages = (result.results as any[]).map((r) => ({
      title: r.title ?? '',
      url: r.url,
      content: r.text ?? '',
    }));

    if (pages.length > 0) {
      return pages;
    }
  } catch (error) {
    const code = getCauseCode(error);
    if (code && CERT_ERROR_CODES.has(code) && canUseInsecureTlsFallback()) {
      console.warn('[business-context] Exa TLS validation failed; falling back to direct website fetch', {
        url,
        code,
      });
      return fetchWebsiteContentDirect(url);
    }
    throw error;
  }

  // If Exa returns no pages, fall back to direct fetch.
  return fetchWebsiteContentDirect(url);
}

// ── Step 4: Brand voice extraction ───────────────────────────────

async function extractBrandVoice(params: {
  businessName:   string;
  websiteContent: WebsitePage[];
  instagram:      InstagramAggregatedResult | null;
  facebook:       FacebookScraperResult | null;
}) {
  const { businessName, websiteContent, instagram, facebook } = params;

  const websiteSummary = websiteContent
    .map((p) => `URL: ${p.url}\nTitle: ${p.title}\n\n${p.content}`)
    .join('\n\n---\n\n')
    .slice(0, 6000);

  const instagramCaptions = instagram
    ? Object.values(Object.values(instagram.postsData)[0]?.posts ?? {})
        .map((p) => p.caption)
        .filter(Boolean)
        .join('\n')
        .slice(0, 3000)
    : '';

  const facebookTexts = facebook
    ? Object.values(facebook.postsData)
        .map((p) => p.postText)
        .filter(Boolean)
        .join('\n')
        .slice(0, 3000)
    : '';

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: brandVoiceSchema,
    prompt: `
You are a brand strategist analyzing a business called "${businessName}".

Analyze the following content from their digital presence and extract their brand voice.

== WEBSITE CONTENT ==
${websiteSummary || '(not available)'}

== INSTAGRAM CAPTIONS ==
${instagramCaptions || '(not available)'}

== FACEBOOK POSTS ==
${facebookTexts || '(not available)'}

Based on this content, extract a comprehensive brand voice profile.
    `.trim(),
  });

  return object;
}

// ── Main orchestrator ─────────────────────────────────────────────

// Reusable stub options for calling tool execute functions directly outside an agent loop
const DIRECT_EXEC = { toolCallId: 'business-context-service', messages: [] } as Parameters<
  NonNullable<typeof scrapeInstagram['execute']>
>[1];

export async function buildBusinessContext(input: BuildBusinessContextInput) {
  const { userId, businessName, websiteUrl, instagramUrl, facebookUrl, postsLimit = 10 } = input;

  // Step 1: Website content
  const websiteContent = await fetchWebsiteContent(websiteUrl);

  // Steps 2, 3 & 4: Instagram, Facebook and visual brand scraped in parallel
  const [instagram, facebook, brand] = await Promise.all([
    instagramUrl
      ? scrapeInstagram.execute!({ profileUrl: instagramUrl, resultsLimit: postsLimit }, DIRECT_EXEC) as Promise<InstagramAggregatedResult>
      : Promise.resolve(null),
    facebookUrl
      ? scrapeFacebook.execute!({ profileUrl: facebookUrl, resultsLimit: postsLimit }, DIRECT_EXEC) as Promise<FacebookScraperResult>
      : Promise.resolve(null),
    scrapeBrand.execute!({ websiteUrl }, DIRECT_EXEC) as Promise<BrandingProfile>,
  ]);

  // Step 5: Brand voice
  const brandVoice = await extractBrandVoice({ businessName, websiteContent, instagram, facebook });

  // Step 6: Persist to MongoDB
  const doc = await BusinessContextModel.create({
    userId,
    businessName,
    websiteUrl,
    instagramUrl,
    facebookUrl,
    websiteContent,
    instagram,
    facebook,
    brand,
    brandVoice,
  });

  return doc;
}
