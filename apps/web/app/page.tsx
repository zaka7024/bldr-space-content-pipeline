'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, AlertCircle } from 'lucide-react';
import AnalyzeForm from './components/AnalyzeForm';
import BusinessResult from './components/BusinessResult';
import CalendarView from './components/CalendarView';
import Dashboard from './components/Dashboard';
import {
  analyzeBusinessContext, generateCalendar, listBusinessContexts,
  getBusinessContext, getBusinessCalendar,
} from './lib/api';
import { getToken, clearToken } from './lib/auth';
import type { AnalyzeInput, CalendarInput } from './lib/api';
import type { BusinessContext, ContentCalendar } from './lib/types';
import type { AuthUser } from './lib/auth';

type Stage = 'loading' | 'dashboard' | 'form' | 'result' | 'calendar';

type BusinessSummary = Pick<BusinessContext, '_id' | 'businessName' | 'websiteUrl' | 'instagramUrl' | 'facebookUrl' | 'createdAt'>;

function parseUserFromToken(token: string): AuthUser | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part));
    return payload.userId ? { _id: payload.userId, name: payload.name ?? '', email: payload.email ?? '' } : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const router = useRouter();

  const [stage,           setStage]           = useState<Stage>('loading');
  const [user,            setUser]            = useState<AuthUser | null>(null);
  const [businesses,      setBusinesses]      = useState<BusinessSummary[]>([]);
  const [context,         setContext]         = useState<BusinessContext | null>(null);
  const [calendar,        setCalendar]        = useState<ContentCalendar | null>(null);
  const [analyzeLoading,  setAnalyzeLoading]  = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [bizLoading,      setBizLoading]      = useState(false);
  const [error,           setError]           = useState<string | null>(null);

  // ── Boot: check auth and load dashboard ────────────────────────

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace('/login'); return; }

    const parsed = parseUserFromToken(token);
    if (!parsed) { clearToken(); router.replace('/login'); return; }

    // Fetch user name/email from the first business or just use token data
    // We store name/email in localStorage alongside the token
    const stored = localStorage.getItem('bldr_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { setUser({ _id: parsed._id, name: '', email: '' }); }
    } else {
      setUser({ _id: parsed._id, name: '', email: '' });
    }

    loadDashboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadDashboard() {
    setBizLoading(true);
    try {
      const list = await listBusinessContexts();
      setBusinesses(list as BusinessSummary[]);
      setStage('dashboard');
    } catch {
      clearToken();
      router.replace('/login');
    } finally {
      setBizLoading(false);
    }
  }

  // ── Analyze new business ───────────────────────────────────────

  async function handleAnalyze(input: AnalyzeInput) {
    setError(null);
    setAnalyzeLoading(true);
    try {
      const ctx = await analyzeBusinessContext(input);
      setContext(ctx);
      setCalendar(null);
      setStage('result');
      // Refresh dashboard list in background
      listBusinessContexts().then((list) => setBusinesses(list as BusinessSummary[])).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setAnalyzeLoading(false);
    }
  }

  // ── View existing business from dashboard ──────────────────────

  async function handleViewBusiness(id: string) {
    setError(null);
    setBizLoading(true);
    try {
      const [ctx, cal] = await Promise.all([
        getBusinessContext(id),
        getBusinessCalendar(id),
      ]);
      setContext(ctx);
      setCalendar(cal);
      setStage('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load business.');
    } finally {
      setBizLoading(false);
    }
  }

  // ── Generate calendar ──────────────────────────────────────────

  async function handleGenerateCalendar(input: CalendarInput) {
    setError(null);
    setCalendarLoading(true);
    try {
      const cal = await generateCalendar(input);
      setCalendar(cal);
      setStage('calendar');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate calendar. Please try again.');
    } finally {
      setCalendarLoading(false);
    }
  }

  // ── Logout ─────────────────────────────────────────────────────

  function handleLogout() {
    clearToken();
    localStorage.removeItem('bldr_user');
    router.replace('/login');
  }

  // ── Step indicator config ──────────────────────────────────────

  const STEPS: Stage[] = ['dashboard', 'form', 'result', 'calendar'];
  const stepIndex = STEPS.indexOf(stage);

  return (
    <div className="min-h-screen bg-[#09090B] font-sans">

      {/* Top nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/60 bg-[#09090B]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => { setStage('dashboard'); setError(null); }}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-zinc-100 tracking-tight">BLDR</span>
            <span className="text-zinc-600 text-sm hidden sm:inline">/ Content Pipeline</span>
          </button>

          {/* Step dots */}
          {stage !== 'dashboard' && stage !== 'loading' && (
            <div className="flex items-center gap-1.5">
              {(['form', 'result', 'calendar'] as Stage[]).map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    stage === s ? 'bg-indigo-400 scale-125' :
                    stepIndex > STEPS.indexOf(s) ? 'bg-zinc-600' : 'bg-zinc-800'
                  }`} />
                  {i < 2 && <div className="w-4 h-px bg-zinc-800" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="pt-14">

        {/* Error toast */}
        {error && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
            <div className="flex items-center gap-3 bg-red-950 border border-red-800 text-red-300 rounded-2xl px-5 py-3.5 shadow-2xl max-w-md">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <p className="text-sm">{error}</p>
              <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-300 transition-colors text-xs">✕</button>
            </div>
          </div>
        )}

        {stage === 'loading' && (
          <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {stage === 'dashboard' && user && (
          <Dashboard
            user={user}
            businesses={businesses}
            loading={bizLoading}
            onNew={() => { setContext(null); setCalendar(null); setStage('form'); }}
            onView={handleViewBusiness}
            onLogout={handleLogout}
          />
        )}

        {stage === 'form' && (
          <AnalyzeForm onSubmit={handleAnalyze} loading={analyzeLoading} />
        )}

        {stage === 'result' && context && (
          <BusinessResult
            context={context}
            existingCalendar={calendar}
            onGenerateCalendar={handleGenerateCalendar}
            onViewCalendar={() => setStage('calendar')}
            calendarLoading={calendarLoading}
            onBack={() => setStage('dashboard')}
          />
        )}

        {stage === 'calendar' && calendar && (
          <CalendarView
            calendar={calendar}
            businessContextId={calendar.businessContextId}
            context={context}
            onCalendarUpdate={setCalendar}
            onError={(msg) => setError(msg)}
            onBack={() => setStage('result')}
          />
        )}
      </main>
    </div>
  );
}
