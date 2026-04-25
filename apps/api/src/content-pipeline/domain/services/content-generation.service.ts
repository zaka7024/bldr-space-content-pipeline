import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import OpenAI, { toFile } from 'openai';
import { z } from 'zod';
import { Types } from 'mongoose';
import axios from 'axios';
import https from 'node:https';
import { BusinessContextModel } from '../models/business-context.model.js';
import { ContentCalendarModel } from '../models/content-calendar.model.js';
import {
  deriveInsights,
  extractRealContent,
  getBrandContextPromptPrefix,
} from './content-calendar.service.js';
import type { InstagramAggregatedResult, FacebookScraperResult } from '../tools/types.js';

const IMAGE_MODEL = 'gpt-image-2' as const;
const IMAGE_SIZE  = '1024x1024' as const;
const MAX_REFERENCE_IMAGES = 8;
const CERT_ERROR_CODES = new Set([
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
]);

let openaiSdk: OpenAI | null = null;

function getOpenAISdk(): OpenAI {
  if (!openaiSdk) {
    const key = process.env.OPENAI_API_KEY;
    if (!key?.trim()) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    openaiSdk = new OpenAI({ apiKey: key });
  }
  return openaiSdk;
}

function b64ToDataUrl(
  b64: string,
  outputFormat: 'png' | 'webp' | 'jpeg' | undefined,
): string {
  const media =
    (outputFormat ?? 'png') === 'png'
      ? 'image/png'
      : outputFormat === 'webp'
        ? 'image/webp'
        : 'image/jpeg';
  return `data:${media};base64,${b64}`;
}

function extractFirstDataUrl(
  res: { data?: Array<{ b64_json?: string | null; url?: string | null }>; output_format?: 'png' | 'webp' | 'jpeg' },
): Promise<string> | string {
  const first = res.data?.[0];
  if (first?.b64_json) {
    return b64ToDataUrl(first.b64_json, res.output_format);
  }
  const imageUrl = first?.url;
  if (imageUrl) {
    return (async () => {
      const download = await fetch(imageUrl);
      if (!download.ok) {
        throw new Error(`Failed to download image from URL: ${download.status}`);
      }
      const buf  = Buffer.from(await download.arrayBuffer());
      const b64  = buf.toString('base64');
      return b64ToDataUrl(b64, res.output_format);
    })();
  }
  throw new Error('OpenAI image generation returned no image (no b64_json or url)');
}

function getCauseCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== 'object') return undefined;
  const code = (cause as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function canUseInsecureTlsFallback(): boolean {
  if (process.env.IMAGE_REFERENCE_ALLOW_INSECURE_TLS === 'true') {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
}

function normalizeReferenceImageUrls(urls: string[] | undefined): string[] {
  if (!urls?.length) return [];
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  return unique.slice(0, MAX_REFERENCE_IMAGES);
}

function extFromContentType(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  return 'jpg';
}

async function fetchReferenceImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Reference image fetch failed: ${res.status}`);
    }
    const contentType = (res.headers.get('content-type') ?? 'image/jpeg').toLowerCase();
    return { buffer: Buffer.from(await res.arrayBuffer()), contentType };
  } catch (error) {
    const code = getCauseCode(error);
    if (!code || !CERT_ERROR_CODES.has(code) || !canUseInsecureTlsFallback()) {
      throw error;
    }

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const res = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      httpsAgent,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BLDR/1.0)' },
    });
    const contentType = String(res.headers['content-type'] ?? 'image/jpeg').toLowerCase();
    return { buffer: Buffer.from(res.data), contentType };
  }
}

async function toReferenceFiles(urls: string[]): Promise<Array<Awaited<ReturnType<typeof toFile>>>> {
  const settled = await Promise.allSettled(
    urls.map(async (url, idx) => {
      const { buffer, contentType } = await fetchReferenceImage(url);
      if (!contentType.startsWith('image/')) {
        throw new Error(`Reference URL is not an image: ${url}`);
      }
      return toFile(buffer, `reference-${idx + 1}.${extFromContentType(contentType)}`, { type: contentType });
    }),
  );

  const files = settled
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof toFile>>> => r.status === 'fulfilled')
    .map((r) => r.value);

  for (const failed of settled) {
    if (failed.status === 'rejected') {
      console.warn('[generate-content] skipped invalid reference image', failed.reason);
    }
  }

  return files;
}

/** Image generation via OpenAI (`images.generate`), or `images.edit` when references are provided. */
async function generateImageDataUrl(
  prompt: string,
  size: typeof IMAGE_SIZE,
  referenceImageUrls: string[] = [],
): Promise<string> {
  const refs = normalizeReferenceImageUrls(referenceImageUrls);

  if (refs.length > 0) {
    try {
      const files = await toReferenceFiles(refs);
      if (files.length > 0) {
        const edited = await getOpenAISdk().images.edit({
          model: IMAGE_MODEL,
          image: files,
          prompt,
          size,
          n: 1,
      
        });
        return await extractFirstDataUrl(edited);
      }
    } catch (error) {
      console.warn('[generate-content] reference-guided image edit failed; falling back to plain generation', error);
    }
  }

  const generated = await getOpenAISdk().images.generate({
    model: IMAGE_MODEL,
    prompt,
    size,
    n: 1,
  });
  return await extractFirstDataUrl(generated);
}

export interface GenerateContentForIdeaInput {
  businessContextId: string;
  calendarId: string;
  ideaId: string;
  overrides?: Partial<{
    date: string;
    dayOfWeek: string;
    title: string;
    description: string;
    suggestedCaption: string;
    hashtags: string[];
    contentTheme: string;
    postType: 'image' | 'carousel';
    platform: 'instagram' | 'facebook' | 'both';
    bestTimeToPost: string;
    justification: string;
  }>;
  referenceImageUrls?: string[];
}

const generatedIdeaContentSchema = z.object({
  primaryCaption: z.string().describe('Main post caption, polished and ready to use'),
  platformCaptions: z.object({
    instagram: z.string().describe('Caption tuned for Instagram (emojis, line breaks as appropriate)'),
    facebook: z.string().describe('Caption tuned for Facebook length and tone'),
  }),
  visualDirection: z.string().describe('Brief for what to show visually (single image or carousel)'),
  carouselFrameBriefs: z
    .array(z.string())
    .describe('For carousel only: one brief per slide in order; empty array if postType is image'),
  hashtags: z.array(z.string()).describe('Hashtags without the # symbol'),
  callToAction: z.string().describe('Specific CTA line for this post'),
  creatorNotes: z.string().describe('Short notes for whoever publishes or creates assets'),
});

function buildIdeaGenerationPrompt(params: {
  prefix: string;
  ideaSnapshot: Record<string, unknown>;
  selectedReferenceImageUrls: string[];
}): string {
  const { prefix, ideaSnapshot, selectedReferenceImageUrls } = params;
  const ideaBlock = JSON.stringify(ideaSnapshot, null, 2);
  const referencesBlock = selectedReferenceImageUrls.length
    ? `\n== USER-SELECTED VISUAL REFERENCES ==\n${selectedReferenceImageUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}`
    : '';

  return `${prefix}

== SELECTED CALENDAR IDEA ==
${ideaBlock}
${referencesBlock}

== TASK ==
Expand this single calendar idea into production-ready social content for the brand.

Rules:
- Mirror the brand voice and real examples from the context above; improve on suggestedCaption — do not discard it
- If postType is "image", carouselFrameBriefs must be an empty array; if "carousel", provide one visual brief per slide in order (typically 3–7 slides)
- Instagram vs Facebook captions may differ in tone and length as appropriate
- Hashtags should mix the idea's tags with top-performing tags from engagement stats when relevant
- If user-selected reference images are provided, align visualDirection and frame briefs to those references while preserving this brand identity
`.trim();
}

function brandColorHint(brand: Record<string, unknown> | null | undefined): string {
  if (!brand) return 'Use a cohesive, professional palette.';
  const b = brand as { colors?: { primary?: string; secondary?: string } };
  const p = b.colors?.primary;
  const s = b.colors?.secondary;
  if (!p && !s) return 'Use a cohesive, professional palette.';
  return `Primary: ${p ?? 'n/a'}. Secondary: ${s ?? 'n/a'}. Reflect these in accents only — keep the image clean.`;
}

function buildSingleImagePrompt(params: {
  businessName: string;
  visualDirection: string;
  primaryCaption: string;
  colorHint: string;
  referenceImageUrls: string[];
}): string {
  const referenceBlock = params.referenceImageUrls.length
    ? `\nReference images to guide style/composition:\n${params.referenceImageUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}`
    : '';

  return `Create a high-quality, professional image for a social media post.

Brand: ${params.businessName}
${params.colorHint}

Visual direction: ${params.visualDirection}
${referenceBlock}

The post will use copy along these lines (do not paste long text into the image; a short on-image headline is optional only if it feels natural):
"${params.primaryCaption.slice(0, 280)}"

Requirements: photoreal or polished brand illustration; uncluttered layout; no distorted anatomy; no fake logos of unrelated companies; no dense paragraphs of text.`.trim();
}

function buildCarouselSlidePrompt(params: {
  businessName: string;
  visualDirection: string;
  frameBrief: string;
  slideIndex: number;
  totalSlides: number;
  colorHint: string;
  referenceImageUrls: string[];
}): string {
  const referenceBlock = params.referenceImageUrls.length
    ? `\nReference images to guide style/composition:\n${params.referenceImageUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}`
    : '';

  return `Create slide ${params.slideIndex + 1} of ${params.totalSlides} for a social media photo carousel (consistent series).

Brand: ${params.businessName}
${params.colorHint}

Series look: ${params.visualDirection}
This slide: ${params.frameBrief}
${referenceBlock}

Keep visual style, lighting, and color grading coherent across all slides. No tiny illegible text; at most one short readable phrase.`.trim();
}

export async function generateContentForIdea(input: GenerateContentForIdeaInput) {
  const {
    businessContextId,
    calendarId,
    ideaId,
    overrides = {},
    referenceImageUrls = [],
  } = input;

  for (const id of [businessContextId, calendarId, ideaId]) {
    if (!Types.ObjectId.isValid(id)) throw new Error('Invalid id');
  }

  const bctx = new Types.ObjectId(businessContextId);
  const cal = new Types.ObjectId(calendarId);
  const iid = new Types.ObjectId(ideaId);

  const calendar = await ContentCalendarModel.findOne({
    _id: cal,
    businessContextId: bctx,
  });
  if (!calendar) {
    throw new Error('Content calendar not found');
  }

  const idea = calendar.ideas.id(iid);
  if (!idea) {
    throw new Error('Content idea not found (ideas created before a calendar refresh may not have an id)');
  }

  const context = await BusinessContextModel.findById(businessContextId).lean();
  if (!context) {
    throw new Error(`BusinessContext ${businessContextId} not found`);
  }

  const ctx = context as {
    businessName: string;
    brandVoice: Record<string, unknown>;
    brand?: Record<string, unknown> | null;
    websiteContent?: { title: string; content: string }[];
    instagram?: InstagramAggregatedResult | null;
    facebook?: FacebookScraperResult | null;
  };

  const insights = deriveInsights(
    (ctx.instagram as InstagramAggregatedResult | null) ?? null,
    (ctx.facebook as FacebookScraperResult | null) ?? null,
  );
  const realContent = extractRealContent(
    (ctx.instagram as InstagramAggregatedResult | null) ?? null,
    (ctx.facebook as FacebookScraperResult | null) ?? null,
  );

  const o = idea.toObject() as {
    date: string;
    dayOfWeek: string;
    title: string;
    description: string;
    suggestedCaption: string;
    hashtags: string[];
    contentTheme: string;
    postType: 'image' | 'carousel';
    platform: 'instagram' | 'facebook' | 'both';
    bestTimeToPost: string;
    justification: string;
  };

  const normalizedHashtags = (overrides.hashtags ?? o.hashtags)
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean);

  const selectedDate = overrides.date ?? o.date;
  const derivedDay = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en', { weekday: 'long' });

  const mergedIdea = {
    date: selectedDate,
    dayOfWeek: overrides.dayOfWeek ?? derivedDay,
    title: overrides.title ?? o.title,
    description: overrides.description ?? o.description,
    suggestedCaption: overrides.suggestedCaption ?? o.suggestedCaption,
    hashtags: normalizedHashtags,
    contentTheme: overrides.contentTheme ?? o.contentTheme,
    postType: overrides.postType ?? o.postType,
    platform: overrides.platform ?? o.platform,
    bestTimeToPost: overrides.bestTimeToPost ?? o.bestTimeToPost,
    justification: overrides.justification ?? o.justification,
  };

  const selectedReferenceImageUrls = normalizeReferenceImageUrls(referenceImageUrls);

  const ideaSnapshot: Record<string, unknown> = {
    date: mergedIdea.date,
    dayOfWeek: mergedIdea.dayOfWeek,
    title: mergedIdea.title,
    description: mergedIdea.description,
    suggestedCaption: mergedIdea.suggestedCaption,
    hashtags: mergedIdea.hashtags,
    contentTheme: mergedIdea.contentTheme,
    postType: mergedIdea.postType,
    platform: mergedIdea.platform,
    bestTimeToPost: mergedIdea.bestTimeToPost,
    justification: mergedIdea.justification,
  };

  const prefix = getBrandContextPromptPrefix({
    businessName: ctx.businessName,
    brandVoice: ctx.brandVoice,
    brand: ctx.brand ?? null,
    insights,
    realContent,
    websiteContent: (ctx.websiteContent ?? []) as { title: string; content: string }[],
  });

  const prompt = buildIdeaGenerationPrompt({ prefix, ideaSnapshot, selectedReferenceImageUrls });

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: generatedIdeaContentSchema,
    prompt,
  });

  const colorHint   = brandColorHint(ctx.brand ?? null);
  const frameBriefs = object.carouselFrameBriefs ?? [];
  const isCarousel  = mergedIdea.postType === 'carousel' && frameBriefs.length > 0;

  let generatedImageDataUrls: string[] = [];
  if (isCarousel) {
    generatedImageDataUrls = await Promise.all(
      frameBriefs.map((frameBrief, slideIndex) =>
        generateImageDataUrl(
          buildCarouselSlidePrompt({
            businessName:    ctx.businessName,
            visualDirection: object.visualDirection,
            frameBrief,
            slideIndex,
            totalSlides:     frameBriefs.length,
            colorHint,
            referenceImageUrls: selectedReferenceImageUrls,
          }),
          IMAGE_SIZE,
          selectedReferenceImageUrls,
        ),
      ),
    );
  } else {
    const dataUrl = await generateImageDataUrl(
      buildSingleImagePrompt({
        businessName:    ctx.businessName,
        visualDirection: object.visualDirection,
        primaryCaption:  object.primaryCaption,
        colorHint,
        referenceImageUrls: selectedReferenceImageUrls,
      }),
      IMAGE_SIZE,
      selectedReferenceImageUrls,
    );
    generatedImageDataUrls = [dataUrl];
  }

  const toStore = {
    primaryCaption: object.primaryCaption,
    platformCaptions: object.platformCaptions,
    visualDirection: object.visualDirection,
    carouselFrameBriefs: object.carouselFrameBriefs,
    hashtags: object.hashtags,
    callToAction: object.callToAction,
    creatorNotes: object.creatorNotes,
    generatedImageDataUrls,
    imageModel: IMAGE_MODEL,
    imageSize: IMAGE_SIZE,
    referenceImageUrls: selectedReferenceImageUrls,
    generatedAt: new Date(),
  };

  const updateSet: Record<string, unknown> = {
    'ideas.$.date': mergedIdea.date,
    'ideas.$.dayOfWeek': mergedIdea.dayOfWeek,
    'ideas.$.title': mergedIdea.title,
    'ideas.$.description': mergedIdea.description,
    'ideas.$.suggestedCaption': mergedIdea.suggestedCaption,
    'ideas.$.hashtags': mergedIdea.hashtags,
    'ideas.$.contentTheme': mergedIdea.contentTheme,
    'ideas.$.postType': mergedIdea.postType,
    'ideas.$.platform': mergedIdea.platform,
    'ideas.$.bestTimeToPost': mergedIdea.bestTimeToPost,
    'ideas.$.justification': mergedIdea.justification,
    'ideas.$.generatedContent': toStore,
  };

  const result = await ContentCalendarModel.findOneAndUpdate(
    { _id: cal, businessContextId: bctx, 'ideas._id': iid },
    { $set: updateSet },
    { new: true },
  ).lean();

  if (!result) {
    throw new Error('Failed to save generated content');
  }

  return result;
}
