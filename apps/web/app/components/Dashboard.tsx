'use client';

import { Globe, Plus, LogOut, Building2, ChevronRight, CalendarDays, Clock } from 'lucide-react';
import type { BusinessContext } from '../lib/types';
import type { AuthUser } from '../lib/auth';

type BusinessSummary = Pick<BusinessContext, '_id' | 'businessName' | 'websiteUrl' | 'instagramUrl' | 'facebookUrl' | 'createdAt'>;

interface Props {
  user:        AuthUser;
  businesses:  BusinessSummary[];
  onNew:       () => void;
  onView:      (id: string) => void;
  onLogout:    () => void;
  loading:     boolean;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}

function BusinessCard({ biz, onView }: { biz: BusinessSummary; onView: () => void }) {
  const platforms: string[] = [];
  if (biz.instagramUrl) platforms.push('Instagram');
  if (biz.facebookUrl)  platforms.push('Facebook');

  return (
    <button
      onClick={onView}
      className="card p-5 text-left w-full group hover:border-zinc-600 transition-all duration-200 hover:shadow-lg hover:shadow-black/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-zinc-100 text-sm truncate group-hover:text-white transition-colors">
              {biz.businessName}
            </h3>
            <div className="flex items-center gap-1 mt-0.5">
              <Globe className="w-3 h-3 text-zinc-600 flex-shrink-0" />
              <span className="text-xs text-zinc-500 truncate">{biz.websiteUrl.replace(/^https?:\/\//, '')}</span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0 mt-1" />
      </div>

      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-zinc-800">
        {platforms.length > 0 && (
          <div className="flex gap-1.5 flex-1 min-w-0">
            {platforms.map((p) => (
              <span key={p} className="badge bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs">
                {p}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 text-xs text-zinc-600 flex-shrink-0 ml-auto">
          <Clock className="w-3 h-3" />
          {timeAgo(biz.createdAt)}
        </div>
      </div>
    </button>
  );
}

export default function Dashboard({ user, businesses, onNew, onView, onLogout, loading }: Props) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 animate-slide-up">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-10">
        <div>
          <p className="section-label mb-1">Welcome back</p>
          <h2 className="text-2xl font-bold text-zinc-50">{user.name}</h2>
          <p className="text-sm text-zinc-500 mt-1">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onNew} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Analysis
          </button>
          <button onClick={onLogout} className="btn-ghost">
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-zinc-800 rounded w-3/4" />
                  <div className="h-3 bg-zinc-800 rounded w-1/2" />
                </div>
              </div>
              <div className="h-px bg-zinc-800 mb-4" />
              <div className="h-3 bg-zinc-800 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : businesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-zinc-800 flex items-center justify-center mb-4">
            <CalendarDays className="w-8 h-8 text-zinc-600" />
          </div>
          <h3 className="font-semibold text-zinc-300 mb-2">No analyses yet</h3>
          <p className="text-sm text-zinc-500 max-w-xs mb-6">
            Run your first business analysis to extract brand context and generate a content calendar.
          </p>
          <button onClick={onNew} className="btn-primary">
            <Plus className="w-4 h-4" />
            Start first analysis
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-zinc-500">
              {businesses.length} {businesses.length === 1 ? 'business' : 'businesses'} analysed
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {businesses.map((biz) => (
              <BusinessCard key={biz._id} biz={biz} onView={() => onView(biz._id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
