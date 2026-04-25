'use client';

import { useState } from 'react';
import { Sparkles, Mail, Lock, User, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { signup, login } from '../lib/api';
import { setToken } from '../lib/auth';
import { useRouter } from 'next/navigation';

interface Props {
  mode: 'login' | 'signup';
}

export default function AuthForm({ mode }: Props) {
  const router = useRouter();
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = mode === 'signup'
        ? await signup(name, email, password)
        : await login(email, password);
      setToken(result.token);
      localStorage.setItem('bldr_user', JSON.stringify(result.user));
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  const isValid = email.trim() && password.trim() && (mode === 'login' || name.trim());

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Logo */}
      <div className="mb-8 text-center animate-fade-in">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600 mb-4">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">BLDR</h1>
        <p className="text-zinc-500 text-sm mt-1">Content Pipeline</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm animate-slide-up">
        <div className="card p-8 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              {mode === 'signup' ? 'Start building your content pipeline' : 'Sign in to your workspace'}
            </p>
          </div>

          {error && (
            <div className="bg-red-950/60 border border-red-800 text-red-300 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="section-label">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                  <input
                    className="input-field pl-10"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="section-label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  className="input-field pl-10"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="section-label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                <input
                  className="input-field pl-10"
                  type="password"
                  placeholder={mode === 'signup' ? 'Min 8 characters' : '••••••••'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={mode === 'signup' ? 8 : 1}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!isValid || loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{mode === 'signup' ? 'Creating account…' : 'Signing in…'}</>
              ) : (
                <>{mode === 'signup' ? 'Create Account' : 'Sign In'}<ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-zinc-500 mt-5">
          {mode === 'signup' ? (
            <>Already have an account?{' '}
              <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Sign in</Link>
            </>
          ) : (
            <>Don&apos;t have an account?{' '}
              <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Create one</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
