import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import OpenAI from 'openai';
import { z } from 'zod';
import { Types } from 'mongoose';
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

/** Image generation via the official OpenAI API (`client.images.generate`). */
async function generateImageDataUrl(prompt: string, size: typeof IMAGE_SIZE): Promise<string> {
  const res = await getOpenAISdk().images.generate({
    model:       IMAGE_MODEL,
    prompt,
    size,
    n:           1,
  });
  const first = res.data?.[0];
  if (first?.b64_json) {
    return b64ToDataUrl(first.b64_json, res.output_format);
  }
  if (first?.url) {
    const download = await fetch(first.url);
    if (!download.ok) {
      throw new Error(`Failed to download image from URL: ${download.status}`);
    }
    const buf  = Buffer.from(await download.arrayBuffer());
    const b64  = buf.toString('base64');
    return b64ToDataUrl(b64, res.output_format);
  }
  throw new Error('OpenAI image generation returned no image (no b64_json or url)');
}

export interface GenerateContentForIdeaInput {
  businessContextId: string;
  calendarId: string;
  ideaId: string;
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
}): string {
  const { prefix, ideaSnapshot } = params;
  const ideaBlock = JSON.stringify(ideaSnapshot, null, 2);

  return `${prefix}

== SELECTED CALENDAR IDEA ==
${ideaBlock}

== TASK ==
Expand this single calendar idea into production-ready social content for the brand.

Rules:
- Mirror the brand voice and real examples from the context above; improve on suggestedCaption — do not discard it
- If postType is "image", carouselFrameBriefs must be an empty array; if "carousel", provide one visual brief per slide in order (typically 3–7 slides)
- Instagram vs Facebook captions may differ in tone and length as appropriate
- Hashtags should mix the idea's tags with top-performing tags from engagement stats when relevant
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
}): string {
  return `Create a high-quality, professional image for a social media post.

Brand: ${params.businessName}
${params.colorHint}

Visual direction: ${params.visualDirection}

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
}): string {
  return `Create slide ${params.slideIndex + 1} of ${params.totalSlides} for a social media photo carousel (consistent series).

Brand: ${params.businessName}
${params.colorHint}

Series look: ${params.visualDirection}
This slide: ${params.frameBrief}

Keep visual style, lighting, and color grading coherent across all slides. No tiny illegible text; at most one short readable phrase.`.trim();
}

export async function generateContentForIdea(input: GenerateContentForIdeaInput) {
  const { businessContextId, calendarId, ideaId } = input;

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

  const ideaSnapshot: Record<string, unknown> = {
    date: o.date,
    dayOfWeek: o.dayOfWeek,
    title: o.title,
    description: o.description,
    suggestedCaption: o.suggestedCaption,
    hashtags: o.hashtags,
    contentTheme: o.contentTheme,
    postType: o.postType,
    platform: o.platform,
    bestTimeToPost: o.bestTimeToPost,
    justification: o.justification,
  };

  const prefix = getBrandContextPromptPrefix({
    businessName: ctx.businessName,
    brandVoice: ctx.brandVoice,
    brand: ctx.brand ?? null,
    insights,
    realContent,
    websiteContent: (ctx.websiteContent ?? []) as { title: string; content: string }[],
  });

  const prompt = buildIdeaGenerationPrompt({ prefix, ideaSnapshot });

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: generatedIdeaContentSchema,
    prompt,
  });

  const colorHint   = brandColorHint(ctx.brand ?? null);
  const frameBriefs = object.carouselFrameBriefs ?? [];
  const isCarousel  = o.postType === 'carousel' && frameBriefs.length > 0;

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
          }),
          IMAGE_SIZE,
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
      }),
      IMAGE_SIZE,
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
    generatedAt: new Date(),
  };

  const result = await ContentCalendarModel.findOneAndUpdate(
    { _id: cal, businessContextId: bctx, 'ideas._id': iid },
    { $set: { 'ideas.$.generatedContent': toStore } },
    { new: true },
  ).lean();

  if (!result) {
    throw new Error('Failed to save generated content');
  }

  return result;
}
