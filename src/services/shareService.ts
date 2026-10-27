// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Shared design links: client for /api/shares and the owner keys kept in this
// browser. See DOCS/SHARED-DESIGNS.md.

export const EXPIRY_CHOICES = [7, 30, 90] as const;
export type ExpiryDays = typeof EXPIRY_CHOICES[number];

export interface ShareSummary {
  services: number;
  monthlyCost?: number;
  region?: string;
  wafBand?: string;
  wafScore?: number;
}

export interface SharePayload {
  design: Record<string, unknown>;
  title: string;
  summary: ShareSummary;
  includeBrief: boolean;
  expiresInDays?: ExpiryDays;
}

export interface SharedDesign {
  id: string;
  title: string;
  design: any;
  summary: ShareSummary;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  appVersion?: string;
  owner?: { views: number; lastViewedAt: string | null };
}

/** A link this browser created; the owner key is what allows update and revoke. */
export interface OwnedShare {
  id: string;
  ownerKey: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

const OWNED_KEY = 'aadb.shares.v1';
const OPEN_COPY_KEY = 'aadb.openCopy.v1';
export const SHARE_ID_RE = /^[A-Za-z0-9_-]{22}$/;

export class ShareError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown, ownerKey?: string): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(ownerKey ? { 'x-owner-key': ownerKey } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fallback = res.status === 404
      ? 'This link has expired or was removed.'
      : res.status === 429
        ? 'Too many requests. Please try again later.'
        : res.status === 503
          ? 'Sharing is not available on this deployment.'
          : 'Something went wrong. Please try again.';
    throw new ShareError(typeof json?.error === 'string' ? json.error : fallback, res.status);
  }
  return json as T;
}

export function shareUrl(id: string): string {
  return `${window.location.origin}/d/${id}`;
}

export function listOwnedShares(now = Date.now()): OwnedShare[] {
  try {
    const raw = JSON.parse(localStorage.getItem(OWNED_KEY) || '[]');
    const list = Array.isArray(raw) ? raw.filter((s) => s && SHARE_ID_RE.test(s.id) && typeof s.ownerKey === 'string') : [];
    const live = list.filter((s: OwnedShare) => Date.parse(s.expiresAt) > now);
    if (live.length !== list.length) saveOwned(live);
    return live.sort((a: OwnedShare, b: OwnedShare) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function saveOwned(list: OwnedShare[]): void {
  try { localStorage.setItem(OWNED_KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
}

function upsertOwned(share: OwnedShare): void {
  saveOwned([share, ...listOwnedShares().filter((s) => s.id !== share.id)]);
}

function forgetOwned(id: string): void {
  saveOwned(listOwnedShares().filter((s) => s.id !== id));
}

export async function createShare(payload: SharePayload): Promise<OwnedShare> {
  const r = await request<{ id: string; ownerKey: string; expiresAt: string; title: string }>('POST', '/api/shares', payload);
  const t = new Date().toISOString();
  const owned: OwnedShare = { id: r.id, ownerKey: r.ownerKey, title: r.title, createdAt: t, updatedAt: t, expiresAt: r.expiresAt };
  upsertOwned(owned);
  return owned;
}

export async function updateShare(share: OwnedShare, payload: SharePayload): Promise<OwnedShare> {
  try {
    const r = await request<{ expiresAt: string; title: string; updatedAt: string }>('PUT', `/api/shares/${share.id}`, payload, share.ownerKey);
    const updated = { ...share, title: r.title, expiresAt: r.expiresAt, updatedAt: r.updatedAt };
    upsertOwned(updated);
    return updated;
  } catch (err) {
    if (err instanceof ShareError && err.status === 404) forgetOwned(share.id);
    throw err;
  }
}

export async function revokeShare(share: OwnedShare): Promise<void> {
  try {
    await request<void>('DELETE', `/api/shares/${share.id}`, undefined, share.ownerKey);
  } catch (err) {
    if (!(err instanceof ShareError && err.status === 404)) throw err;
  }
  forgetOwned(share.id);
}

/** Read a shared design. With the owner key, the server also reports views and doesn't count this read. */
export async function getShare(id: string, ownerKey?: string): Promise<SharedDesign> {
  if (!SHARE_ID_RE.test(id)) throw new ShareError('This link is not valid.', 404);
  return request<SharedDesign>('GET', `/api/shares/${id}`, undefined, ownerKey);
}

/** "Open a copy": hand the design to the editor through sessionStorage, then navigate to the app. */
export function stashCopyForEditor(shared: SharedDesign): void {
  sessionStorage.setItem(OPEN_COPY_KEY, JSON.stringify({ title: shared.title, design: shared.design, from: shared.id }));
}

export function takeCopyForEditor(): { title: string; design: any; from: string } | null {
  try {
    const raw = sessionStorage.getItem(OPEN_COPY_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(OPEN_COPY_KEY);
    const parsed = JSON.parse(raw);
    return parsed && parsed.design && Array.isArray(parsed.design.nodes) ? parsed : null;
  } catch {
    return null;
  }
}

export function formatExpiry(expiresAt: string, now = Date.now()): string {
  const days = Math.ceil((Date.parse(expiresAt) - now) / 86_400_000);
  if (days <= 0) return 'expires today';
  if (days === 1) return 'expires tomorrow';
  return `expires in ${days} days`;
}
