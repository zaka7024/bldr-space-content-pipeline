'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  Hash,
  Image as ImageIcon,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { BusinessContext, ContentCalendar, ContentIdea } from '../lib/types';
import { generateContentForIdea } from '../lib/api';

interface Props {
  calendar: ContentCalendar;
  businessContextId: string;
  context?: BusinessContext | null;
  onCalendarUpdate: (calendar: ContentCalendar) => void;
  onError: (message: string) => void;
  onBack: () => void;
}

interface ReferenceImageOption {
  key: string;
  source: 'instagram' | 'facebook' | 'website';
  url: string;
  postUrl?: string;
}

interface EditableIdeaFields {
  date: string;
  dayOfWeek: string;
  title: string;
  description: string;
  suggestedCaption: string;
  hashtagsText: string;
  contentTheme: string;
  postType: 'image' | 'carousel';
  platform: 'instagram' | 'facebook' | 'both';
  bestTimeToPost: string;
  justification: string;
}

interface GenerateDraftPayload {
  overrides: {
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
  referenceImageUrls: string[];
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

function deriveDayOfWeek(date: string): string {
  if (!date) return 'Unknown';
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en', { weekday: 'long' });
}

function parseHashtags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n,\s]+/g)
        .map((token) => token.trim().replace(/^#/, ''))
        .filter(Boolean),
    ),
  ];
}

function draftFromIdea(idea: ContentIdea): EditableIdeaFields {
  return {
    date: idea.date,
    dayOfWeek: idea.dayOfWeek,
    title: idea.title,
    description: idea.description,
    suggestedCaption: idea.suggestedCaption,
    hashtagsText: idea.hashtags.map((tag) => `#${tag}`).join(', '),
    contentTheme: idea.contentTheme,
    postType: idea.postType,
    platform: idea.platform,
    bestTimeToPost: idea.bestTimeToPost,
    justification: idea.justification,
  };
}

function buildReferenceImages(context?: BusinessContext | null): ReferenceImageOption[] {
  if (!context) return [];

  const fromInstagram = (context.instagram?.images ?? []).map((img, idx) => ({
    key: `ig-${idx}-${img.url}`,
    source: 'instagram' as const,
    url: img.url,
    postUrl: img.postUrl,
  }));

  const fromFacebook = (context.facebook?.images ?? []).map((img, idx) => ({
    key: `fb-${idx}-${img.url}`,
    source: 'facebook' as const,
    url: img.url,
    postUrl: img.referencePostUrl,
  }));

  const fromWebsite = [
    context.brand?.images?.logo
      ? {
          key: `web-logo-${context.brand.images.logo}`,
          source: 'website' as const,
          url: context.brand.images.logo,
          postUrl: context.websiteUrl,
        }
      : null,
    context.brand?.images?.ogImage
      ? {
          key: `web-og-${context.brand.images.ogImage}`,
          source: 'website' as const,
          url: context.brand.images.ogImage,
          postUrl: context.websiteUrl,
        }
      : null,
  ].filter(Boolean) as ReferenceImageOption[];

  const merged = [...fromInstagram, ...fromFacebook, ...fromWebsite];
  const seen = new Set<string>();

  return merged
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .slice(0, 36);
}

const POST_TYPE_CONFIG = {
  image: {
    icon: ImageIcon,
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    label: 'Image',
  },
  carousel: {
    icon: LayoutGrid,
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    label: 'Carousel',
  },
} as const;

const PLATFORM_CONFIG = {
  instagram: { icon: Camera, bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  facebook: { icon: Users, bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  both: { icon: Globe, bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
} as const;

function PostTypeBadge({ type }: { type: ContentIdea['postType'] }) {
  const cfg = POST_TYPE_CONFIG[type];
  const Icon = cfg.icon;
  return (
    <span className={`badge ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: ContentIdea['platform'] }) {
  const cfg = PLATFORM_CONFIG[platform];
  const Icon = cfg.icon;
  return (
    <span className={`badge ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
      <Icon className="w-3 h-3" />
      {platform === 'both' ? 'All platforms' : platform.charAt(0).toUpperCase() + platform.slice(1)}
    </span>
  );
}

function IdeaCard({
  idea,
  onOpenEditor,
}: {
  idea: ContentIdea;
  onOpenEditor: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const dateObj = new Date(`${idea.date}T12:00:00`);
  const dayNum = dateObj.getDate();
  const monthShort = dateObj.toLocaleString('en', { month: 'short' });

  return (
    <div className="card overflow-hidden transition-all duration-200 hover:border-zinc-700">
      <div className="flex">
        <div className="flex flex-col items-center justify-center w-16 flex-shrink-0 bg-zinc-800/60 border-r border-zinc-800 py-4 gap-0.5">
          <span className="text-xs text-zinc-500 font-medium uppercase">{monthShort}</span>
          <span className="text-2xl font-bold text-zinc-100 leading-none">{dayNum}</span>
          <span className="text-xs text-zinc-500">{idea.dayOfWeek.slice(0, 3)}</span>
        </div>

        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex flex-wrap gap-1.5">
              <PostTypeBadge type={idea.postType} />
              <PlatformBadge platform={idea.platform} />
              <span className="badge bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs">{idea.contentTheme}</span>
            </div>
            <div className="flex items-center gap-1 text-zinc-400 flex-shrink-0 text-xs">
              <Clock className="w-3 h-3" />
              {idea.bestTimeToPost}
            </div>
          </div>

          <h4 className="font-semibold text-zinc-100 text-sm mb-1 leading-snug">{idea.title}</h4>
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{idea.description}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenEditor}
              disabled={!idea._id}
              title={!idea._id ? 'Re-generate the calendar once to attach idea ids, then try again' : 'Open post editor'}
              className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {idea.generatedContent ? 'Edit and regenerate post' : 'Generate full post'}
            </button>

            {!idea._id && <span className="text-[10px] text-zinc-600">(save a new calendar for per-idea tools)</span>}
          </div>

          <button
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-indigo-400 transition-colors mt-3"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3" /> Hide details
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" /> Caption, hashtags & justification
              </>
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-4 space-y-4 animate-fade-in">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
              <span className="section-label">Suggested Caption</span>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-3.5">
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{idea.suggestedCaption}</p>
            </div>
          </div>

          {idea.hashtags.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Hash className="w-3.5 h-3.5 text-zinc-500" />
                <span className="section-label">Hashtags</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {idea.hashtags.map((tag) => (
                  <span key={tag} className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2 py-1">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span className="section-label">Why this time & format</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed border-l-2 border-emerald-500/30 pl-3">{idea.justification}</p>
          </div>

          {idea.generatedContent && (
            <div className="space-y-4 border-t border-zinc-800/80 pt-4">
              <p className="text-xs font-semibold text-amber-400/90 uppercase tracking-wide">Generated for this idea</p>

              {(idea.generatedContent.generatedImageDataUrls?.length ?? 0) > 0 && (
                <div>
                  <span className="section-label">AI images</span>
                  <p className="text-[10px] text-zinc-600 mt-0.5 mb-2">
                    {[idea.generatedContent.imageModel, idea.generatedContent.imageSize].filter(Boolean).join(' · ')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(idea.generatedContent.generatedImageDataUrls ?? []).map((dataUrl, imgIdx) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={imgIdx}
                        src={dataUrl}
                        alt={`Generated asset ${imgIdx + 1}`}
                        className="w-full rounded-xl border border-zinc-800 object-cover max-h-80"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GeneratePostDrawer({
  open,
  idea,
  referenceImages,
  generating,
  onClose,
  onGenerate,
}: {
  open: boolean;
  idea: ContentIdea | null;
  referenceImages: ReferenceImageOption[];
  generating: boolean;
  onClose: () => void;
  onGenerate: (payload: GenerateDraftPayload) => void;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'references' | 'review'>('details');
  const [draft, setDraft] = useState<EditableIdeaFields | null>(null);
  const [selectedReferences, setSelectedReferences] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !idea) return;
    setActiveTab('details');
    setDraft(draftFromIdea(idea));
    setSelectedReferences(idea.generatedContent?.referenceImageUrls ?? []);
  }, [open, idea]);

  if (!idea || !draft) {
    return null;
  }

  function setDraftField<K extends keyof EditableIdeaFields>(key: K, value: EditableIdeaFields[K]) {
    setDraft((prev) => {
      if (!prev) return prev;
      if (key === 'date') {
        return {
          ...prev,
          date: value as string,
          dayOfWeek: deriveDayOfWeek(value as string),
        };
      }
      return { ...prev, [key]: value };
    });
  }

  function toggleReference(url: string) {
    setSelectedReferences((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  }

  function handleGenerate() {
    const current = draft;
    if (!current) return;

    onGenerate({
      overrides: {
        date: current.date,
        dayOfWeek: current.dayOfWeek,
        title: current.title,
        description: current.description,
        suggestedCaption: current.suggestedCaption,
        hashtags: parseHashtags(current.hashtagsText),
        contentTheme: current.contentTheme,
        postType: current.postType,
        platform: current.platform,
        bestTimeToPost: current.bestTimeToPost,
        justification: current.justification,
      },
      referenceImageUrls: selectedReferences,
    });
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/35 backdrop-blur-[1px] z-40 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside
        className={`fixed top-0 right-0 h-full w-full sm:w-[560px] bg-[#0B0B0F] border-l border-zinc-800 z-50 transform transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        aria-hidden={!open}
      >
        <div className="h-full flex flex-col">
          <div className="h-14 border-b border-zinc-800 px-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Generate Full Post</p>
              <h3 className="text-sm font-semibold text-zinc-100 truncate">{idea.title}</h3>
            </div>
            <button onClick={onClose} className="btn-ghost px-2 py-1.5" type="button">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 pt-3 border-b border-zinc-800">
            <div className="flex gap-2 pb-3">
              {([
                ['details', 'Details'],
                ['references', 'References'],
                ['review', 'Review'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${activeTab === key ? 'bg-zinc-100 text-zinc-900 border-zinc-100' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {activeTab === 'details' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="section-label">Date</label>
                    <input type="date" className="input-field h-9 py-1.5" value={draft.date} onChange={(e) => setDraftField('date', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="section-label">Day</label>
                    <input className="input-field h-9 py-1.5" value={draft.dayOfWeek} onChange={(e) => setDraftField('dayOfWeek', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="section-label">Best Time</label>
                    <input className="input-field h-9 py-1.5" value={draft.bestTimeToPost} onChange={(e) => setDraftField('bestTimeToPost', e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="section-label">Theme</label>
                    <input className="input-field h-9 py-1.5" value={draft.contentTheme} onChange={(e) => setDraftField('contentTheme', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="section-label">Post Type</label>
                    <select className="input-field h-9 py-1.5" value={draft.postType} onChange={(e) => setDraftField('postType', e.target.value as ContentIdea['postType'])}>
                      <option value="image">Image</option>
                      <option value="carousel">Carousel</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="section-label">Platform</label>
                    <select className="input-field h-9 py-1.5" value={draft.platform} onChange={(e) => setDraftField('platform', e.target.value as ContentIdea['platform'])}>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="section-label">Title</label>
                  <input className="input-field h-9 py-1.5" value={draft.title} onChange={(e) => setDraftField('title', e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="section-label">Description</label>
                  <textarea className="input-field min-h-20" value={draft.description} onChange={(e) => setDraftField('description', e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="section-label">Suggested Caption</label>
                  <textarea className="input-field min-h-24" value={draft.suggestedCaption} onChange={(e) => setDraftField('suggestedCaption', e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <label className="section-label">Hashtags</label>
                  <input className="input-field h-9 py-1.5" value={draft.hashtagsText} onChange={(e) => setDraftField('hashtagsText', e.target.value)} placeholder="#Sustainability, #EcoFriendly" />
                </div>

                <div className="space-y-1.5">
                  <label className="section-label">Why this time & format</label>
                  <textarea
                    className="input-field min-h-24"
                    value={draft.justification}
                    onChange={(e) => setDraftField('justification', e.target.value)}
                    placeholder="Mention date + time and one context signal (engagement/day/type/top-performing pattern)."
                  />
                </div>
              </div>
            )}

            {activeTab === 'references' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="section-label">Select reference images</p>
                  <span className="text-[10px] text-zinc-500">{selectedReferences.length} selected</span>
                </div>

                {referenceImages.length === 0 ? (
                  <p className="text-sm text-zinc-500">No reference images are available for this business context.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {referenceImages.map((ref) => {
                      const selected = selectedReferences.includes(ref.url);
                      return (
                        <button
                          key={ref.key}
                          type="button"
                          onClick={() => toggleReference(ref.url)}
                          className={`relative rounded-xl overflow-hidden border transition-all ${selected ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-zinc-800 hover:border-zinc-600'}`}
                          title={ref.postUrl ?? ref.url}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={proxy(ref.url)} alt={`${ref.source} reference`} className="w-full aspect-square object-cover" loading="lazy" />
                          <div className="absolute left-1.5 bottom-1.5 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-black/70 text-zinc-200">
                            {ref.source}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'review' && (
              <div className="space-y-4">
                <div>
                  <p className="section-label mb-1">Title</p>
                  <p className="text-sm text-zinc-200">{draft.title}</p>
                </div>

                <div>
                  <p className="section-label mb-1">Caption</p>
                  <p className="text-sm text-zinc-300 whitespace-pre-wrap">{draft.suggestedCaption}</p>
                </div>

                <div>
                  <p className="section-label mb-1">Hashtags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {parseHashtags(draft.hashtagsText).map((tag) => (
                      <span key={tag} className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2 py-1">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="section-label mb-1">Why this time & format</p>
                  <p className="text-xs text-zinc-400 leading-relaxed border-l-2 border-emerald-500/30 pl-3">{draft.justification}</p>
                </div>

                <div>
                  <p className="section-label mb-1">Selected references</p>
                  <p className="text-xs text-zinc-500">{selectedReferences.length} image(s)</p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800 p-4 flex gap-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">
              Close
            </button>
            <button type="button" onClick={handleGenerate} disabled={generating} className="btn-primary flex-1">
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate post
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function CalendarView({
  calendar,
  businessContextId,
  context,
  onCalendarUpdate,
  onError,
  onBack,
}: Props) {
  const [filter, setFilter] = useState<'all' | 'image' | 'carousel'>('all');
  const [editorIdeaId, setEditorIdeaId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorGenerating, setEditorGenerating] = useState(false);

  const referenceImages = useMemo(() => buildReferenceImages(context), [context]);

  const start = new Date(calendar.startDate).toLocaleDateString('en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const end = new Date(calendar.endDate).toLocaleDateString('en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const filtered = filter === 'all' ? calendar.ideas : calendar.ideas.filter((i) => i.postType === filter);

  const counts = {
    image: calendar.ideas.filter((i) => i.postType === 'image').length,
    carousel: calendar.ideas.filter((i) => i.postType === 'carousel').length,
  };

  const editorIdea = useMemo(
    () => calendar.ideas.find((idea) => idea._id === editorIdeaId) ?? null,
    [calendar.ideas, editorIdeaId],
  );

  async function handleGenerateFromDrawer(payload: GenerateDraftPayload) {
    if (!editorIdea?._id || editorGenerating) return;
    setEditorGenerating(true);
    try {
      const updated = await generateContentForIdea(businessContextId, calendar._id, editorIdea._id, {
        overrides: payload.overrides,
        referenceImageUrls: payload.referenceImageUrls,
      });
      onCalendarUpdate(updated);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not generate content.');
    } finally {
      setEditorGenerating(false);
    }
  }

  function openEditorForIdea(idea: ContentIdea) {
    if (!idea._id) {
      onError('Re-generate the calendar once to attach idea ids, then try again.');
      return;
    }
    setEditorIdeaId(idea._id);
    setEditorOpen(true);
  }

  function closeDrawer() {
    setEditorOpen(false);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 animate-slide-up">
      <div className="mb-8">
        <button onClick={onBack} className="btn-ghost mb-4 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          Back to context
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="section-label mb-1">Content Calendar</p>
            <h2 className="text-2xl font-bold text-zinc-50">{calendar.ideas.length} ideas generated</h2>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-zinc-500">
              <CalendarDays className="w-3.5 h-3.5" />
              {start} — {end}
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <div className="text-center px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-sm font-bold text-blue-400">{counts.image}</p>
              <p className="text-xs text-zinc-500">Images</p>
            </div>
            <div className="text-center px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-sm font-bold text-amber-400">{counts.carousel}</p>
              <p className="text-xs text-zinc-500">Carousels</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {(['all', 'image', 'carousel'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-all duration-150 ${
              filter === f
                ? 'bg-zinc-100 border-zinc-200 text-zinc-900'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
            }`}
          >
            {f === 'all'
              ? `All (${calendar.ideas.length})`
              : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f]})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((idea, i) => (
          <IdeaCard key={idea._id ?? `${idea.date}-${i}`} idea={idea} onOpenEditor={() => openEditorForIdea(idea)} />
        ))}
      </div>

      <GeneratePostDrawer
        open={editorOpen}
        idea={editorIdea}
        referenceImages={referenceImages}
        generating={editorGenerating}
        onClose={closeDrawer}
        onGenerate={handleGenerateFromDrawer}
      />
    </div>
  );
}
