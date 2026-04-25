import type { BusinessContext, ContentCalendar } from './types';
import { getToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

// ── Auth ───────────────────────────────────────────────────────────

export interface AuthResult {
  token: string;
  user:  { _id: string; name: string; email: string };
}

export function signup(name: string, email: string, password: string): Promise<AuthResult> {
  return request<AuthResult>('/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) });
}

export function login(email: string, password: string): Promise<AuthResult> {
  return request<AuthResult>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

// ── Business context ───────────────────────────────────────────────

export interface AnalyzeInput {
  businessName:  string;
  websiteUrl:    string;
  instagramUrl?: string;
  facebookUrl?:  string;
  postsLimit?:   number;
}

export function analyzeBusinessContext(input: AnalyzeInput): Promise<BusinessContext> {
  return request<BusinessContext>('/business-context', { method: 'POST', body: JSON.stringify(input) });
}

export function listBusinessContexts(): Promise<Pick<BusinessContext, '_id' | 'businessName' | 'websiteUrl' | 'instagramUrl' | 'facebookUrl' | 'createdAt'>[]> {
  return request('/business-contexts', { method: 'GET' });
}

export function getBusinessContext(id: string): Promise<BusinessContext> {
  return request<BusinessContext>(`/business-contexts/${id}`, { method: 'GET' });
}

export function getBusinessCalendar(businessContextId: string): Promise<ContentCalendar | null> {
  return request<ContentCalendar | null>(`/business-contexts/${businessContextId}/calendar`, { method: 'GET' });
}

// ── Content calendar ───────────────────────────────────────────────

export interface CalendarInput {
  businessContextId: string;
  daysRange?:        number;
  startDate?:        string;
}

export function generateCalendar(input: CalendarInput): Promise<ContentCalendar> {
  return request<ContentCalendar>('/content-calendar', { method: 'POST', body: JSON.stringify(input) });
}

export function generateContentForIdea(
  businessContextId: string,
  calendarId:        string,
  ideaId:            string,
): Promise<ContentCalendar> {
  return request<ContentCalendar>(
    `/content-calendar/${calendarId}/ideas/${ideaId}/generate`,
    { method: 'POST', body: JSON.stringify({ businessContextId }) },
  );
}
