import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { Types } from 'mongoose';
import { BusinessContextModel } from '../models/business-context.model.js';
import { ContentCalendarModel } from '../models/content-calendar.model.js';
import type { InstagramAggregatedResult, FacebookScraperResult, InstagramPost, FacebookPostData } from '../tools/types.js';

// ── Public input ──────────────────────────────────────────────────

export interface GenerateContentCalendarInput {
  businessContextId: string;
  daysRange?:        number;    // default 30, max 90
  startDate?:        string;    // ISO date, defaults to today
}

// ── Output schema for generateObject ─────────────────────────────

const contentIdeaSchema = z.object({
  date:             z.string().describe('ISO date string, e.g. 2026-05-01'),
  dayOfWeek:        z.string().describe('Day name, e.g. Monday'),
  title:            z.string().describe('Short punchy post idea title'),
  description:      z.string().describe('What the post is about and why it matters for the brand'),
  suggestedCaption: z.string().describe('Ready-to-use caption for the post'),
  hashtags:         z.array(z.string()).describe('Relevant hashtags without the # symbol'),
  contentTheme:     z.string().describe('Which brand content theme this idea belongs to'),
  postType:         z.enum(['image', 'carousel']).describe('Best format for this idea'),
  platform:         z.enum(['instagram', 'facebook', 'both']).describe('Best platform for this post'),
  bestTimeToPost:   z.string().describe('Best time to post, e.g. 6:30 PM'),
  justification:    z.string().describe('Why this day, time and format — cite engagement data where possible'),
});

const contentCalendarSchema = z.object({
  ideas: z.array(contentIdeaSchema),
});

// ── Engagement analysis (pure TS, no AI) ─────────────────────────

export interface EngagementInsights {
  instagram: {
    bestDays:       string[];
    bestPostType:   'image' | 'carousel';
    avgByType:      Record<string, number>;
    avgByDay:       Record<string, number>;
    topHashtags:    string[];
  } | null;
  facebook: {
    bestDays:       string[];
    avgByDay:       Record<string, number>;
    avgEngagement:  number;
  } | null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function analyzeInstagram(data: InstagramAggregatedResult): EngagementInsights['instagram'] {
  const profileData = Object.values(data.postsData)[0];
  if (!profileData) return null;

  const posts = Object.values(profileData.posts) as InstagramPost[];
  if (!posts.length) return null;

  // Engagement by post type
  const typeStats: Record<string, { total: number; count: number }> = {};
  for (const post of posts) {
    const type = post.type.toLowerCase() === 'sidecar' ? 'carousel' : post.type.toLowerCase();
    const engagement = (post.likesCount ?? 0) + (post.commentsCount ?? 0);
    if (!typeStats[type]) typeStats[type] = { total: 0, count: 0 };
    typeStats[type].total += engagement;
    typeStats[type].count += 1;
  }

  const avgByType: Record<string, number> = {};
  for (const [type, stat] of Object.entries(typeStats)) {
    avgByType[type] = Math.round(stat.total / stat.count);
  }

  const topType = Object.entries(avgByType).sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'image';
  const bestPostType: 'image' | 'carousel' = topType === 'carousel' ? 'carousel' : 'image';

  // Engagement by day of week
  const dayStats: Record<string, { total: number; count: number }> = {};
  for (const post of posts) {
    if (!post.timestamp) continue;
    const day = DAYS[new Date(post.timestamp).getDay()] ?? 'Unknown';
    const engagement = (post.likesCount ?? 0) + (post.commentsCount ?? 0);
    if (!dayStats[day]) dayStats[day] = { total: 0, count: 0 };
    dayStats[day].total += engagement;
    dayStats[day].count += 1;
  }

  const avgByDay: Record<string, number> = {};
  for (const [day, stat] of Object.entries(dayStats)) {
    avgByDay[day] = Math.round(stat.total / stat.count);
  }

  const bestDays = Object.entries(avgByDay)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([day]) => day);

  // Top hashtags from captions
  const hashtagCounts: Record<string, number> = {};
  for (const post of posts) {
    for (const tag of post.hashtags ?? []) {
      hashtagCounts[tag] = (hashtagCounts[tag] ?? 0) + 1;
    }
  }
  const topHashtags = Object.entries(hashtagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([tag]) => tag);

  return { bestDays, bestPostType, avgByType, avgByDay, topHashtags };
}

function analyzeFacebook(data: FacebookScraperResult): EngagementInsights['facebook'] {
  const posts = Object.values(data.postsData) as FacebookPostData[];
  if (!posts.length) return null;

  const dayStats: Record<string, { total: number; count: number }> = {};
  let totalEngagement = 0;

  for (const post of posts) {
    if (!post.timestamp) continue;
    const day = DAYS[new Date(post.timestamp * 1000).getDay()] ?? 'Unknown';
    const engagement = (post.postLikes ?? 0) + (post.postShares ?? 0) + (post.postComments ?? 0);
    if (!dayStats[day]) dayStats[day] = { total: 0, count: 0 };
    dayStats[day].total += engagement;
    dayStats[day].count += 1;
    totalEngagement += engagement;
  }

  const avgByDay: Record<string, number> = {};
  for (const [day, stat] of Object.entries(dayStats)) {
    avgByDay[day] = Math.round(stat.total / stat.count);
  }

  const bestDays = Object.entries(avgByDay)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([day]) => day);

  return {
    bestDays,
    avgByDay,
    avgEngagement: Math.round(totalEngagement / posts.length),
  };
}

export function deriveInsights(
  instagram: InstagramAggregatedResult | null,
  facebook: FacebookScraperResult | null,
): EngagementInsights {
  return {
    instagram: instagram ? analyzeInstagram(instagram) : null,
    facebook:  facebook  ? analyzeFacebook(facebook)   : null,
  };
}

// ── Real content extractor ────────────────────────────────────────

export interface RealContent {
  instagram: {
    bio:            string;
    followers:      number;
    category:       string;
    topCaptions:    { caption: string; likes: number; comments: number; type: string }[];
    mentionedBrands: string[];
  } | null;
  facebook: {
    pageName:  string;
    topPosts:  { text: string; likes: number; shares: number; comments: number }[];
  } | null;
}

export function extractRealContent(
  instagram: InstagramAggregatedResult | null,
  facebook:  FacebookScraperResult | null,
): RealContent {
  let igContent: RealContent['instagram'] = null;

  if (instagram) {
    const profileEntry = Object.values(instagram.postsData)[0];
    const profileData  = profileEntry?.profileData;
    const posts        = Object.values(profileEntry?.posts ?? {}) as InstagramPost[];

    const topCaptions = posts
      .filter((p) => p.caption)
      .sort((a, b) => ((b.likesCount ?? 0) + (b.commentsCount ?? 0)) - ((a.likesCount ?? 0) + (a.commentsCount ?? 0)))
      .slice(0, 5)
      .map((p) => ({
        caption:  p.caption!,
        likes:    p.likesCount    ?? 0,
        comments: p.commentsCount ?? 0,
        type:     p.type.toLowerCase(),
      }));

    const mentionedBrands = [...new Set(posts.flatMap((p) => p.mentions ?? []))].slice(0, 10);

    igContent = {
      bio:             profileData?.biography          ?? '',
      followers:       profileData?.followersCount      ?? 0,
      category:        profileData?.businessCategoryName ?? '',
      topCaptions,
      mentionedBrands,
    };
  }

  let fbContent: RealContent['facebook'] = null;

  if (facebook) {
    const topPosts = Object.values(facebook.postsData)
      .filter((p) => p.postText)
      .sort((a, b) => ((b.postLikes ?? 0) + (b.postShares ?? 0) + (b.postComments ?? 0)) - ((a.postLikes ?? 0) + (a.postShares ?? 0) + (a.postComments ?? 0)))
      .slice(0, 5)
      .map((p) => ({
        text:     p.postText!,
        likes:    p.postLikes    ?? 0,
        shares:   p.postShares   ?? 0,
        comments: p.postComments ?? 0,
      }));

    fbContent = {
      pageName: facebook.profileMetadata?.profilePageName ?? '',
      topPosts,
    };
  }

  return { instagram: igContent, facebook: fbContent };
}

// ── Date slot builder ─────────────────────────────────────────────

function buildDateSlots(startDate: Date, daysRange: number): { date: string; dayOfWeek: string }[] {
  return Array.from({ length: daysRange }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return {
      date:      d.toISOString().split('T')[0]!,
      dayOfWeek: DAYS[d.getDay()]!,
    };
  });
}

// ── Prompt builder ────────────────────────────────────────────────

/** Brand, channel and engagement context shared by calendar and single-idea generation. */
export function getBrandContextPromptPrefix(params: {
  businessName:   string;
  brandVoice:     Record<string, unknown>;
  brand:          Record<string, unknown> | null;
  insights:       EngagementInsights;
  realContent:    RealContent;
  websiteContent: { title: string; content: string }[];
}): string {
  const { businessName, brandVoice, brand, insights, realContent, websiteContent } = params;

  const websiteSummary = websiteContent
    .map((p) => `${p.title}: ${p.content}`.slice(0, 400))
    .join('\n')
    .slice(0, 1200);

  const igRealBlock = realContent.instagram
    ? `
Instagram profile:
- Bio: ${realContent.instagram.bio || '(none)'}
- Followers: ${realContent.instagram.followers.toLocaleString()}
- Category: ${realContent.instagram.category || '(none)'}
- Mentioned brands/accounts: ${realContent.instagram.mentionedBrands.join(', ') || '(none)'}

Top performing Instagram captions (ranked by likes + comments):
${realContent.instagram.topCaptions.map((c, i) =>
  `${i + 1}. [${c.type} | ${c.likes} likes, ${c.comments} comments]\n   "${c.caption.slice(0, 280)}"`
).join('\n')}`
    : 'No Instagram content available.';

  const fbRealBlock = realContent.facebook
    ? `
Facebook page: ${realContent.facebook.pageName}

Top performing Facebook posts (ranked by likes + shares + comments):
${realContent.facebook.topPosts.map((p, i) =>
  `${i + 1}. [${p.likes} likes, ${p.shares} shares, ${p.comments} comments]\n   "${p.text.slice(0, 280)}"`
).join('\n')}`
    : 'No Facebook content available.';

  const igInsights = insights.instagram
    ? `
Instagram engagement stats:
- Best posting days: ${insights.instagram.bestDays.join(', ')}
- Best performing post type: ${insights.instagram.bestPostType}
- Avg engagement by type: ${JSON.stringify(insights.instagram.avgByType)}
- Avg engagement by day: ${JSON.stringify(insights.instagram.avgByDay)}
- Top hashtags: ${insights.instagram.topHashtags.join(', ')}`
    : '';

  const fbInsights = insights.facebook
    ? `
Facebook engagement stats:
- Best posting days: ${insights.facebook.bestDays.join(', ')}
- Avg engagement by day: ${JSON.stringify(insights.facebook.avgByDay)}
- Avg engagement per post: ${insights.facebook.avgEngagement}`
    : '';

  const brandColors = brand
    ? `Primary: ${(brand as any).colors?.primary ?? 'n/a'}, Secondary: ${(brand as any).colors?.secondary ?? 'n/a'}`
    : 'n/a';

  return `
You are a social media strategist for "${businessName}".

== BRAND VOICE ==
Tone: ${(brandVoice as any).tone}
Style: ${(brandVoice as any).style}
Target audience: ${(brandVoice as any).targetAudience}
Unique value: ${(brandVoice as any).uniqueValueProposition}
Content themes: ${((brandVoice as any).contentThemes as string[]).join(', ')}
Keywords: ${((brandVoice as any).keywords as string[]).join(', ')}

== VISUAL BRAND ==
Colors: ${brandColors}

== WEBSITE OFFERING ==
${websiteSummary || '(not available)'}

== REAL INSTAGRAM CONTENT ==
${igRealBlock}

== REAL FACEBOOK CONTENT ==
${fbRealBlock}

== ENGAGEMENT STATS ==
${igInsights}
${fbInsights}`.trim();
}

function buildPrompt(params: {
  businessName:   string;
  brandVoice:     Record<string, unknown>;
  brand:          Record<string, unknown> | null;
  insights:       EngagementInsights;
  realContent:    RealContent;
  dateSlots:      { date: string; dayOfWeek: string }[];
  websiteContent: { title: string; content: string }[];
}): string {
  const { dateSlots } = params;
  const prefix = getBrandContextPromptPrefix(params);
  const slots = dateSlots.map((s) => `${s.date} (${s.dayOfWeek})`).join(', ');

  return `${prefix}

== TASK ==
Generate exactly one content idea for EACH of the following dates:
${slots}

Rules:
- Study the real captions and posts above — mirror the brand's authentic voice, recurring phrases and topics
- Vary post types (image, carousel) and platforms — do not repeat the same format every day
- Anchor bestTimeToPost and justification to the engagement stats above
- Suggested captions must feel like they were written by this brand, not a generic template
- Hashtags must include the brand's own top-performing tags mixed with relevant trending ones
- contentTheme must map to one of the brand's content themes listed above
- On high-engagement days prioritise carousel over single images
`.trim();
}

// ── Main service ──────────────────────────────────────────────────

export async function generateContentCalendar(input: GenerateContentCalendarInput) {
  const { businessContextId, daysRange = 30, startDate } = input;

  if (!Types.ObjectId.isValid(businessContextId)) {
    throw new Error('Invalid businessContextId');
  }

  // 1. Fetch BusinessContext
  const context = await BusinessContextModel.findById(businessContextId).lean();
  if (!context) throw new Error(`BusinessContext ${businessContextId} not found`);

  const ctx = context as any;

  // 2. Derive engagement insights and real post samples (pure TS)
  const insights = deriveInsights(
    ctx.instagram as InstagramAggregatedResult | null,
    ctx.facebook  as FacebookScraperResult | null,
  );
  const realContent = extractRealContent(
    ctx.instagram as InstagramAggregatedResult | null,
    ctx.facebook  as FacebookScraperResult | null,
  );

  // 3. Build date slots
  const start = startDate ? new Date(startDate) : new Date();
  start.setHours(0, 0, 0, 0);
  const clampedRange = Math.min(Math.max(daysRange, 1), 90);
  const dateSlots = buildDateSlots(start, clampedRange);

  const end = new Date(start);
  end.setDate(end.getDate() + clampedRange - 1);

  // 4. Generate ideas via LLM
  const prompt = buildPrompt({
    businessName:   ctx.businessName,
    brandVoice:     ctx.brandVoice,
    brand:          ctx.brand ?? null,
    insights,
    realContent,
    dateSlots,
    websiteContent: (ctx.websiteContent ?? []) as { title: string; content: string }[],
  });

  const { object } = await generateObject({
    model:  openai('gpt-4o-mini'),
    schema: contentCalendarSchema,
    prompt,
  });

  // 5. Persist and return
  const doc = await ContentCalendarModel.create({
    businessContextId: new Types.ObjectId(businessContextId),
    startDate:         start,
    endDate:           end,
    ideas:             object.ideas,
  });

  return doc;
}
