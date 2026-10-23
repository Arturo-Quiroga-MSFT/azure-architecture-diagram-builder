// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Video tour manifest. The episodes are published by demo-videos/engine/publish-web.sh to a static
// location (Blob Storage in production, public/media/videos when developing) together with videos.json.
// Swapping a re-filmed episode only needs a new upload; the app reads the manifest at runtime.

import { useEffect, useState } from 'react';

export interface VideoChapter { title: string; at: number; key?: string }

export interface TourVideo {
  id: string;
  badge: string;
  title: string;
  summary: string;
  duration: number;
  filmed?: string | null;
  appVersion?: string | null;
  src: string;
  poster?: string;
  captions?: string;
  chapters: VideoChapter[];
}

export interface VideoTopic { video: string; at: number; title: string }

export interface VideoManifest {
  version: number;
  title: string;
  videos: TourVideo[];
  topics: Record<string, VideoTopic>;
  playlists: { id: string; label: string; episodes: string[] }[];
}

export const VIDEO_BASE_URL = String(import.meta.env?.VITE_VIDEO_BASE_URL || '/media/videos').replace(/\/+$/, '');

export const TRAILER_ID = '00-trailer';

export function mediaUrl(file: string): string {
  return /^https?:\/\//.test(file) ? file : `${VIDEO_BASE_URL}/${file}`;
}

let manifestPromise: Promise<VideoManifest | null> | null = null;

export function isVideoManifest(value: unknown): value is VideoManifest {
  const m = value as VideoManifest;
  return !!m && Array.isArray(m.videos) && m.videos.every((v) => typeof v?.id === 'string' && typeof v?.src === 'string' && Array.isArray(v?.chapters));
}

export function loadVideoManifest(): Promise<VideoManifest | null> {
  if (!manifestPromise) {
    manifestPromise = fetch(`${VIDEO_BASE_URL}/videos.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => (isVideoManifest(json) ? { ...json, topics: json.topics || {}, playlists: json.playlists || [] } : null))
      .catch(() => null)
      .then((m) => {
        if (!m) manifestPromise = null; // retry on the next open
        return m;
      });
  }
  return manifestPromise;
}

/** undefined while loading, null when the tour is unavailable. */
export function useVideoManifest(enabled = true): VideoManifest | null | undefined {
  const [manifest, setManifest] = useState<VideoManifest | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadVideoManifest().then((m) => { if (live) setManifest(m); });
    return () => { live = false; };
  }, [enabled]);
  return manifest;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatFilmed(video: Pick<TourVideo, 'filmed' | 'appVersion'>): string {
  const parts: string[] = [];
  if (video.filmed) {
    const d = new Date(`${video.filmed}T12:00:00Z`);
    parts.push(Number.isNaN(d.getTime()) ? video.filmed : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  }
  if (video.appVersion) parts.push(`v${video.appVersion}`);
  return parts.length ? `Filmed ${parts.join(' on ')}` : '';
}

/** Link to the shareable /videos page, optionally at a video and time. */
export function videoPageUrl(videoId?: string, at?: number): string {
  const params = new URLSearchParams();
  if (videoId) params.set('v', videoId);
  if (videoId && at && at > 0) params.set('t', String(Math.floor(at)));
  const q = params.toString();
  return `${window.location.origin}/videos${q ? `?${q}` : ''}`;
}
