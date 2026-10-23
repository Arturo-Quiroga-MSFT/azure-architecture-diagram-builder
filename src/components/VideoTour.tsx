// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Clock, ExternalLink, Film, Link2, ListVideo, Play } from 'lucide-react';
import {
  formatDuration, formatFilmed, mediaUrl, useVideoManifest, videoPageUrl,
  type TourVideo, type VideoManifest,
} from '../services/videoTour';
import { trackVideoTour } from '../services/telemetryService';
import './VideoTour.css';

export interface VideoTourSelection { video: string; at?: number; nonce?: number }

interface VideoTourProps {
  /** Video (and start time) to open; changing `nonce` re-applies the same selection. */
  selection?: VideoTourSelection | null;
  source: 'help' | 'help-topic' | 'start-here' | 'page';
  variant?: 'embedded' | 'page';
  /** Optional preloaded manifest; otherwise the component loads it. */
  manifest?: VideoManifest | null;
}

const VideoTour: React.FC<VideoTourProps> = ({ selection, source, variant = 'embedded', manifest: given }) => {
  const loaded = useVideoManifest(given === undefined);
  const manifest = given === undefined ? loaded : given;
  const [current, setCurrent] = useState<string | null>(selection?.video ?? null);
  const [startAt, setStartAt] = useState<number>(selection?.at ?? 0);
  const [playlist, setPlaylist] = useState<string>('all');

  useEffect(() => {
    if (selection?.video) { setCurrent(selection.video); setStartAt(selection.at ?? 0); }
  }, [selection?.video, selection?.at, selection?.nonce]);

  useEffect(() => { trackVideoTour({ action: 'open', source }); }, [source]);

  const video = manifest?.videos.find((v) => v.id === current) ?? null;

  if (manifest === undefined) return <div className="video-tour-state">Loading the video tour…</div>;
  if (manifest === null || manifest.videos.length === 0) {
    return <div className="video-tour-state">The video tour isn&apos;t available right now. Please try again later.</div>;
  }

  if (video) {
    return <VideoPlayer key={video.id} video={video} manifest={manifest} startAt={startAt} source={source} variant={variant}
      onBack={() => { setCurrent(null); setStartAt(0); }}
      onSelect={(id) => { setCurrent(id); setStartAt(0); }} />;
  }

  const visible = playlist === 'all'
    ? manifest.videos
    : (manifest.playlists.find((p) => p.id === playlist)?.episodes ?? [])
      .map((id) => manifest.videos.find((v) => v.id === id)).filter((v): v is TourVideo => !!v);
  const total = manifest.videos.reduce((sum, v) => sum + v.duration, 0);

  return (
    <div className={`video-tour video-tour-${variant}`}>
      <div className="video-tour-intro">
        <div>
          <p className="video-tour-eyebrow">Video tour</p>
          <h2>See every feature in action</h2>
          <p>{manifest.videos.length} short narrated videos, {Math.round(total / 60)} minutes in all, filmed on the live app. Captions and chapters included.</p>
        </div>
        {variant === 'embedded' && (
          <a className="video-tour-page-link" href={videoPageUrl()} target="_blank" rel="noopener noreferrer">
            Open as a page <ExternalLink size={14} />
          </a>
        )}
      </div>
      {manifest.playlists.length > 0 && (
        <div className="video-tour-playlists" role="tablist" aria-label="Playlists">
          {[{ id: 'all', label: 'All videos' }, ...manifest.playlists].map((p) => (
            <button key={p.id} role="tab" aria-selected={playlist === p.id} className={playlist === p.id ? 'active' : ''} onClick={() => setPlaylist(p.id)}>{p.label}</button>
          ))}
        </div>
      )}
      <div className="video-tour-grid">
        {visible.map((v) => (
          <button key={v.id} className="video-tour-card" onClick={() => { setCurrent(v.id); setStartAt(0); }} aria-label={`Play ${v.title}`}>
            <span className="video-tour-thumb">
              {v.poster ? <img src={mediaUrl(v.poster)} alt="" loading="lazy" /> : <Film size={28} />}
              <span className="video-tour-play"><Play size={18} /></span>
              <span className="video-tour-duration">{formatDuration(v.duration)}</span>
            </span>
            <span className="video-tour-card-text">
              <small>{v.badge}</small>
              <strong>{v.title}</strong>
              <span>{v.summary}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface PlayerProps {
  video: TourVideo;
  manifest: VideoManifest;
  startAt: number;
  source: VideoTourProps['source'];
  variant: 'embedded' | 'page';
  onBack: () => void;
  onSelect: (id: string) => void;
}

function VideoPlayer({ video, manifest, startAt, source, variant, onBack, onSelect }: PlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const played = useRef(false);
  const milestone = useRef(0);
  const [time, setTime] = useState(startAt);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const seek = () => { if (startAt > 0) el.currentTime = startAt; };
    if (el.readyState >= 1) seek(); else el.addEventListener('loadedmetadata', seek, { once: true });
    el.play().catch(() => { /* autoplay may be blocked; the controls remain */ });
    return () => el.removeEventListener('loadedmetadata', seek);
  }, [startAt]);

  const activeChapter = useMemo(() => {
    let idx = -1;
    video.chapters.forEach((c, i) => { if (time + 0.25 >= c.at) idx = i; });
    return idx;
  }, [time, video.chapters]);

  const index = manifest.videos.findIndex((v) => v.id === video.id);
  const next = index >= 0 ? manifest.videos[index + 1] : undefined;

  const jump = (at: number, title: string) => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = at;
    el.play().catch(() => { /* ignore */ });
    trackVideoTour({ action: 'chapter', video: video.id, chapter: title, position: at, duration: video.duration, source });
  };

  const share = async () => {
    const url = videoPageUrl(video.id, ref.current?.currentTime);
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { window.prompt('Copy this link', url); }
    trackVideoTour({ action: 'share', video: video.id, position: ref.current?.currentTime, duration: video.duration, source });
  };

  return (
    <div className={`video-tour video-tour-${variant}`}>
      <div className="video-tour-player-head">
        <button className="video-tour-back" onClick={onBack}><ArrowLeft size={15} /> All videos</button>
        <button className="video-tour-share" onClick={share} title="Copy a link to this video at the current time">
          {copied ? <Check size={14} /> : <Link2 size={14} />}{copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
      <div className="video-tour-player">
        <div className="video-tour-stage">
          <video
            ref={ref}
            controls
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            poster={video.poster ? mediaUrl(video.poster) : undefined}
            src={mediaUrl(video.src)}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              setTime(t);
              const share = video.duration ? t / video.duration : 0;
              const step = share >= 0.75 ? 3 : share >= 0.5 ? 2 : share >= 0.25 ? 1 : 0;
              if (step > milestone.current) { milestone.current = step; trackVideoTour({ action: 'progress', video: video.id, position: t, duration: video.duration, source }); }
            }}
            onPlay={() => {
              if (played.current) return;
              played.current = true;
              trackVideoTour({ action: 'play', video: video.id, position: ref.current?.currentTime, duration: video.duration, source });
            }}
            onEnded={() => trackVideoTour({ action: 'complete', video: video.id, position: video.duration, duration: video.duration, source })}
          >
            {/* Subtitles are burned into the picture; this track is for screen readers and larger text, off by default. */}
            {video.captions && <track kind="captions" src={mediaUrl(video.captions)} srcLang="en" label="English" />}
          </video>
        </div>
        <aside className="video-tour-side">
          <small className="video-tour-badge">{video.badge}</small>
          <h2>{video.title}</h2>
          <p>{video.summary}</p>
          <p className="video-tour-meta"><Clock size={13} /> {formatDuration(video.duration)}{formatFilmed(video) && <> · {formatFilmed(video)}</>}</p>
          {video.chapters.length > 0 && (
            <>
              <h3><ListVideo size={14} /> Chapters</h3>
              <ol className="video-tour-chapters">
                {video.chapters.map((c, i) => (
                  <li key={`${c.at}-${c.title}`}>
                    <button className={i === activeChapter ? 'active' : ''} onClick={() => jump(c.at, c.title)}>
                      <span>{formatDuration(c.at)}</span>{c.title}
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
          {next && (
            <button className="video-tour-next" onClick={() => onSelect(next.id)}>
              <small>Up next · {next.badge}</small><strong>{next.title}</strong>
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

export default VideoTour;
