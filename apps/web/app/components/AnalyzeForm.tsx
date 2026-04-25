'use client';

import { useState } from 'react';
import { Globe, Camera, Users, Hash, Loader2, Sparkles, ArrowRight } from 'lucide-react';
import type { AnalyzeInput } from '../lib/api';

interface Props {
  onSubmit: (input: AnalyzeInput) => void;
  loading:  boolean;
}

export default function AnalyzeForm({ onSubmit, loading }: Props) {
  const [form, setForm] = useState<AnalyzeInput>({
    businessName: '',
    websiteUrl:   '',
    instagramUrl: '',
    facebookUrl:  '',
    postsLimit:   10,
  });

  function set(field: keyof AnalyzeInput) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: AnalyzeInput = { ...form };
    if (!input.instagramUrl) delete input.instagramUrl;
    if (!input.facebookUrl)  delete input.facebookUrl;
    onSubmit(input);
  }

  const isValid = form.businessName.trim() && form.websiteUrl.trim();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="mb-10 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-6">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-medium text-indigo-300">AI-Powered Content Pipeline</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-zinc-50 mb-3">
          Build your<br />
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            brand context
          </span>
        </h1>
        <p className="text-zinc-400 text-base max-w-md mx-auto leading-relaxed">
          Enter your business details. We'll scrape your website, Instagram and Facebook to extract brand voice, identity and generate a 30-day content calendar.
        </p>
      </div>

      {/* Form card */}
      <div className="w-full max-w-xl animate-slide-up">
        <form onSubmit={handleSubmit} className="card p-8 space-y-5">

          {/* Business name */}
          <div className="space-y-1.5">
            <label className="section-label">Business Name *</label>
            <div className="relative">
              <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                className="input-field pl-10"
                placeholder="Al Ameed Coffee"
                value={form.businessName}
                onChange={set('businessName')}
                required
              />
            </div>
          </div>

          {/* Website */}
          <div className="space-y-1.5">
            <label className="section-label">Website URL *</label>
            <div className="relative">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                className="input-field pl-10"
                placeholder="https://www.yourbrand.com"
                type="url"
                value={form.websiteUrl}
                onChange={set('websiteUrl')}
                required
              />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-600">Social profiles (optional)</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Instagram */}
          <div className="space-y-1.5">
            <label className="section-label">Instagram Profile</label>
            <div className="relative">
              <Camera className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                className="input-field pl-10"
                placeholder="https://www.instagram.com/yourbrand/"
                type="url"
                value={form.instagramUrl}
                onChange={set('instagramUrl')}
              />
            </div>
          </div>

          {/* Facebook */}
          <div className="space-y-1.5">
            <label className="section-label">Facebook Page</label>
            <div className="relative">
              <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                className="input-field pl-10"
                placeholder="https://www.facebook.com/yourbrand"
                type="url"
                value={form.facebookUrl}
                onChange={set('facebookUrl')}
              />
            </div>
          </div>

          {/* Posts limit */}
          <div className="space-y-1.5">
            <label className="section-label">Posts to analyse</label>
            <div className="flex gap-2">
              {[5, 10, 20, 50].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, postsLimit: n }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all duration-150 ${
                    form.postsLimit === n
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid || loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analysing business…
              </>
            ) : (
              <>
                Analyse Business
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-zinc-600 mt-4">
          This may take 1–2 minutes while we scrape and analyse your content.
        </p>
      </div>
    </div>
  );
}
