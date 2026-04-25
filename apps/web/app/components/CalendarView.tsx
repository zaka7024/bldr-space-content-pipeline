'use client';

import { useState } from 'react';
import {
  Clock, CalendarDays, Image as ImageIcon, LayoutGrid,
  Camera, Users, Globe, ChevronDown, ChevronUp, Hash,
  MessageSquare, ArrowLeft,
} from 'lucide-react';
import type { ContentCalendar, ContentIdea } from '../lib/types';

interface Props {
  calendar: ContentCalendar;
  onBack:   () => void;
}

// ── Badge helpers ─────────────────────────────────────────────────

const POST_TYPE_CONFIG = {
  image:    { icon: ImageIcon,  bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/20',   label: 'Image'    },
  carousel: { icon: LayoutGrid, bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/20',  label: 'Carousel' },
} as const;

const PLATFORM_CONFIG = {
  instagram: { icon: Camera, bg: 'bg-pink-500/10',    text: 'text-pink-400',    border: 'border-pink-500/20'    },
  facebook:  { icon: Users,  bg: 'bg-indigo-500/10',  text: 'text-indigo-400',  border: 'border-indigo-500/20'  },
  both:      { icon: Globe,  bg: 'bg-violet-500/10',  text: 'text-violet-400',  border: 'border-violet-500/20'  },
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

// ── Single idea card ──────────────────────────────────────────────

function IdeaCard({ idea, index }: { idea: ContentIdea; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const dateObj    = new Date(idea.date + 'T12:00:00');
  const dayNum     = dateObj.getDate();
  const monthShort = dateObj.toLocaleString('en', { month: 'short' });

  return (
    <div className="card overflow-hidden transition-all duration-200 hover:border-zinc-700">
      <div className="flex">
        {/* Date block */}
        <div className="flex flex-col items-center justify-center w-16 flex-shrink-0 bg-zinc-800/60 border-r border-zinc-800 py-4 gap-0.5">
          <span className="text-xs text-zinc-500 font-medium uppercase">{monthShort}</span>
          <span className="text-2xl font-bold text-zinc-100 leading-none">{dayNum}</span>
          <span className="text-xs text-zinc-500">{idea.dayOfWeek.slice(0, 3)}</span>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex flex-wrap gap-1.5">
              <PostTypeBadge type={idea.postType} />
              <PlatformBadge platform={idea.platform} />
              <span className="badge bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs">
                {idea.contentTheme}
              </span>
            </div>
            <div className="flex items-center gap-1 text-zinc-400 flex-shrink-0 text-xs">
              <Clock className="w-3 h-3" />
              {idea.bestTimeToPost}
            </div>
          </div>

          <h4 className="font-semibold text-zinc-100 text-sm mb-1 leading-snug">{idea.title}</h4>
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">{idea.description}</p>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-indigo-400 transition-colors mt-3"
          >
            {expanded ? (
              <><ChevronUp className="w-3 h-3" /> Hide details</>
            ) : (
              <><ChevronDown className="w-3 h-3" /> Caption, hashtags & justification</>
            )}
          </button>
        </div>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-4 space-y-4 animate-fade-in">
          {/* Caption */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
              <span className="section-label">Suggested Caption</span>
            </div>
            <div className="bg-zinc-800/60 rounded-xl p-3.5">
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{idea.suggestedCaption}</p>
            </div>
          </div>

          {/* Hashtags */}
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

          {/* Justification */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span className="section-label">Why this time & format</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed border-l-2 border-emerald-500/30 pl-3">
              {idea.justification}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calendar view ─────────────────────────────────────────────────

export default function CalendarView({ calendar, onBack }: Props) {
  const [filter, setFilter] = useState<'all' | 'image' | 'carousel'>('all');

  const start    = new Date(calendar.startDate).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });
  const end      = new Date(calendar.endDate).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });
  const filtered = filter === 'all' ? calendar.ideas : calendar.ideas.filter((i) => i.postType === filter);

  const counts = {
    image:    calendar.ideas.filter((i) => i.postType === 'image').length,
    carousel: calendar.ideas.filter((i) => i.postType === 'carousel').length,
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 animate-slide-up">

      {/* Header */}
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

          {/* Stats pills */}
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

      {/* Filter tabs */}
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
            {f === 'all' ? `All (${calendar.ideas.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f]})`}
          </button>
        ))}
      </div>

      {/* Ideas list */}
      <div className="space-y-3">
        {filtered.map((idea, i) => (
          <IdeaCard key={`${idea.date}-${i}`} idea={idea} index={i} />
        ))}
      </div>
    </div>
  );
}
