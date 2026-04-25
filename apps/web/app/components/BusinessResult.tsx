'use client';

import { useState } from 'react';
import {
  Target, Palette, Image as ImageIcon, Users, Quote,
  Tag, Lightbulb, CalendarDays, ArrowRight, ExternalLink, Loader2, ArrowLeft, Eye,
} from 'lucide-react';
import type { BusinessContext, ContentCalendar } from '../lib/types';

import type { CalendarInput } from '../lib/api';

interface Props {
  context:            BusinessContext;
  existingCalendar?:  ContentCalendar | null;
  onGenerateCalendar: (input: CalendarInput) => void;
  onViewCalendar?:    () => void;
  calendarLoading:    boolean;
  onBack:             () => void;
}

function ColorSwatch({ name, value }: { name: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-lg border border-white/10 flex-shrink-0 shadow-sm"
        style={{ backgroundColor: value }}
      />
      <div>
        <p className="text-xs font-medium text-zinc-200 capitalize">{name}</p>
        <p className="text-xs text-zinc-500 font-mono">{value}</p>
      </div>
    </div>
  );
}

function Tag_({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors">
      {label}
    </span>
  );
}

const CDN_DOMAINS = ['cdninstagram.com', 'fbcdn.net'];

function proxy(url: string): string {
  try {
    const { hostname } = new URL(url);
    if (!CDN_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) return url;
  } catch {
    return url;
  }
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function MediaGrid({ images }: {
  images?: { url: string; postUrl?: string }[];
}) {
  const items = (images ?? []).slice(0, 12);
  if (!items.length) return null;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {items.map((item, i) => (
        <a
          key={i}
          href={item.postUrl ?? item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative group aspect-square rounded-xl overflow-hidden bg-zinc-800"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxy(item.url)}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 ring-1 ring-inset ring-white/5 rounded-xl" />
        </a>
      ))}
    </div>
  );
}

export default function BusinessResult({ context, existingCalendar, onGenerateCalendar, onViewCalendar, calendarLoading, onBack }: Props) {
  const [daysRange, setDaysRange] = useState(30);

  const { brandVoice, brand, instagram, facebook } = context;

  const instagramProfile = instagram?.postsData ? Object.values(instagram.postsData)[0] : undefined;
  const instagramImages  = instagram?.images ?? instagramProfile?.images ?? [];
  const facebookImages   = (facebook?.images ?? []).map(({ url, referencePostUrl }) => ({ url, postUrl: referencePostUrl }));

  // Brand / website images: logo + ogImage (skip favicon — too small)
  const websiteImages = [
    brand?.images?.logo    ? { url: brand.images.logo,    postUrl: context.websiteUrl } : null,
    brand?.images?.ogImage ? { url: brand.images.ogImage, postUrl: context.websiteUrl } : null,
  ].filter((x): x is { url: string; postUrl: string } => !!x?.url);

  const logoUrl = brand?.images?.logo ?? brand?.logo ?? null;

  const brandColors = Object.entries(brand?.colors ?? {}).filter(([, v]) => v) as [string, string][];
  const primaryFont = brand?.typography?.fontFamilies?.primary
    ?? brand?.fonts?.[0]?.family
    ?? null;

  function handleGenerate() {
    onGenerateCalendar({
      businessContextId: context._id,
      daysRange,
      startDate: new Date().toISOString().split('T')[0],
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-6 animate-slide-up">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={onBack} className="btn-ghost mb-3 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
          <p className="section-label mb-1">Business Context</p>
          <h2 className="text-2xl font-bold text-zinc-50">{context.businessName}</h2>
          <a
            href={context.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-indigo-400 transition-colors mt-1"
          >
            {context.websiteUrl}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {instagramProfile?.profilePicUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxy(instagramProfile.profilePicUrl)}
            alt={context.businessName}
            className="w-14 h-14 rounded-full border-2 border-zinc-700 object-cover flex-shrink-0"
          />
        )}
      </div>

      {/* Grid: Brand Voice + Visual Identity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Brand Voice */}
        {brandVoice && (
          <div className="card p-6 space-y-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-indigo-400" />
              </div>
              <h3 className="font-semibold text-zinc-100">Brand Voice</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-800/60 rounded-xl p-3">
                <p className="section-label mb-1">Tone</p>
                <p className="text-sm text-zinc-200 font-medium">{brandVoice.tone}</p>
              </div>
              <div className="bg-zinc-800/60 rounded-xl p-3">
                <p className="section-label mb-1">Style</p>
                <p className="text-sm text-zinc-200 font-medium">{brandVoice.style}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <p className="section-label">Target Audience</p>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{brandVoice.targetAudience}</p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-3.5 h-3.5 text-zinc-500" />
                <p className="section-label">Unique Value</p>
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed">{brandVoice.uniqueValueProposition}</p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="w-3.5 h-3.5 text-zinc-500" />
                <p className="section-label">Content Themes</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {brandVoice.contentThemes.map((t) => <Tag_ key={t} label={t} />)}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="w-3.5 h-3.5 text-zinc-500" />
                <p className="section-label">Keywords</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {brandVoice.keywords.map((k) => <Tag_ key={k} label={k} />)}
              </div>
            </div>

            {brandVoice.examplePhrases.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Quote className="w-3.5 h-3.5 text-zinc-500" />
                  <p className="section-label">Example Phrases</p>
                </div>
                <div className="space-y-2">
                  {brandVoice.examplePhrases.slice(0, 3).map((p, i) => (
                    <p key={i} className="text-sm text-zinc-400 italic border-l-2 border-indigo-500/40 pl-3">
                      "{p}"
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Visual Identity */}
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Palette className="w-4 h-4 text-violet-400" />
            </div>
            <h3 className="font-semibold text-zinc-100">Visual Identity</h3>
          </div>

          {/* Logo */}
          {logoUrl && (
            <div>
              <p className="section-label mb-3">Logo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={brand?.images?.logoAlt ?? 'Brand logo'}
                className="h-12 object-contain"
              />
            </div>
          )}

          {/* Colors */}
          {brandColors.length > 0 && (
            <div>
              <p className="section-label mb-3">Colours</p>
              <div className="grid grid-cols-2 gap-3">
                {brandColors.slice(0, 6).map(([name, value]) => (
                  <ColorSwatch key={name} name={name} value={value} />
                ))}
              </div>
            </div>
          )}

          {/* Font */}
          {primaryFont && (
            <div>
              <p className="section-label mb-2">Primary Font</p>
              <p className="text-base text-zinc-200 font-medium">{primaryFont}</p>
            </div>
          )}

          {/* Colour scheme */}
          {brand?.colorScheme && (
            <div className="flex items-center gap-2">
              <span className={`badge ${brand.colorScheme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-800'}`}>
                {brand.colorScheme === 'dark' ? '🌙 Dark scheme' : '☀️ Light scheme'}
              </span>
            </div>
          )}

          {/* Fallback when brand not available */}
          {!brand && (
            <p className="text-sm text-zinc-500">
              No Firecrawl branding data — add <code className="text-zinc-400">FIRECRAWL_API_KEY</code> to enable visual identity extraction.
            </p>
          )}
        </div>
      </div>

      {/* Media Gallery */}
      {(instagramImages.length > 0 || facebookImages.length > 0 || websiteImages.length > 0) && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-pink-400" />
            </div>
            <h3 className="font-semibold text-zinc-100">Reference Content</h3>
            <span className="text-xs text-zinc-500 ml-auto">
              {instagramImages.length + facebookImages.length + websiteImages.length} assets
            </span>
          </div>

          {instagramImages.length > 0 && (
            <div>
              <p className="section-label mb-3">Instagram</p>
              <MediaGrid images={instagramImages} />
            </div>
          )}

          {facebookImages.length > 0 && (
            <div>
              <p className="section-label mb-3">Facebook</p>
              <MediaGrid images={facebookImages} />
            </div>
          )}

          {websiteImages.length > 0 && (
            <div>
              <p className="section-label mb-3">Website</p>
              <MediaGrid images={websiteImages} />
            </div>
          )}
        </div>
      )}

      {/* Generate Calendar CTA */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="font-semibold text-zinc-100">Generate Content Calendar</h3>
        </div>

        <p className="text-sm text-zinc-400 mb-5">
          Generate AI-powered post ideas with optimal times and justifications based on your brand data and engagement insights.
        </p>

        <div className="flex items-center gap-3 mb-5">
          <span className="text-sm text-zinc-400">Days range:</span>
          <div className="flex gap-2">
            {[7, 14, 30, 60].map((n) => (
              <button
                key={n}
                onClick={() => setDaysRange(n)}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-all duration-150 ${
                  daysRange === n
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                }`}
              >
                {n}d
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {existingCalendar && onViewCalendar && (
            <button
              onClick={onViewCalendar}
              className="btn-ghost border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              <Eye className="w-4 h-4" />
              View existing calendar ({existingCalendar.ideas.length} ideas)
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={calendarLoading}
            className="btn-primary bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700"
          >
            {calendarLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating {daysRange}-day calendar…
              </>
            ) : (
              <>
                {existingCalendar ? 'Regenerate' : 'Generate'} {daysRange}-day Calendar
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
