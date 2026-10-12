// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Narrator settings — choose the talking avatar and voice used for workflow
 * narration and Compare critiques, with a live preview.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, RotateCcw, Square } from 'lucide-react';
import { AvatarPresenter, type AvatarStatus } from '../services/avatarPresenter';
import { listNarrators, NARRATOR_VOICES, type NarratorPreset } from '../data/narrators';
import { narratorAvatarOptions, resolveNarrator, useNarratorPrefs } from '../stores/narratorStore';

const GROUPS: Array<{ kind: NarratorPreset['kind']; label: string; preview?: boolean }> = [
  { kind: 'custom', label: 'Custom avatar' },
  { kind: 'full-body', label: 'Full-body avatars' },
  { kind: 'photo', label: 'Photo avatars' },
  { kind: 'photo', label: 'Photo avatars (preview)', preview: true },
];

export function NarratorSettings() {
  const [prefs, setPrefs] = useNarratorPrefs();
  const narrators = useMemo(() => listNarrators(), []);
  const resolved = resolveNarrator(prefs, narrators);
  const defaultNarrator = resolveNarrator({ narratorId: 'default', voice: 'auto' }, narrators).preset;
  const voiceLocked = Boolean(resolved.useBuiltInVoice);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const presenterRef = useRef<AvatarPresenter | null>(null);
  const [status, setStatus] = useState<AvatarStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const previewing = status === 'connecting' || status === 'ready' || status === 'speaking';

  const stopPreview = () => {
    presenterRef.current?.disconnect();
    presenterRef.current = null;
    setStatus('idle');
  };

  useEffect(() => stopPreview, []);
  // A different narrator needs a new avatar session.
  useEffect(() => {
    setError(null);
    if (presenterRef.current) stopPreview();
  }, [prefs.narratorId, prefs.voice]);

  const startPreview = async () => {
    if (!videoRef.current || !audioRef.current) return;
    setError(null);
    const presenter: AvatarPresenter = new AvatarPresenter({
      ...narratorAvatarOptions(),
      // Ignore late callbacks from a preview that was stopped or replaced.
      onStatus: next => { if (presenterRef.current === presenter) setStatus(next); },
      onError: msg => { if (presenterRef.current === presenter) setError(msg); },
    });
    presenterRef.current = presenter;
    // Sessions count against the Speech resource's concurrency limit, so a
    // preview that was stopped or replaced while connecting must be closed.
    const superseded = () => presenterRef.current !== presenter;
    try {
      await presenter.connect(videoRef.current, audioRef.current);
      if (superseded()) { presenter.disconnect(); return; }
      const name = resolved.preset.label.split(' · ')[0];
      await presenter.speak(`Hi, I'm ${name}. I'll walk you through your Azure architecture, one step at a time.`);
      if (presenterRef.current === presenter) stopPreview();
    } catch (e) {
      presenter.disconnect();
      if (superseded()) return;
      const message = (e as Error).message || 'The narrator could not start.';
      setError(/4429|throttl/i.test(message)
        ? 'The Speech service is busy (too many live avatar sessions). Wait a minute and try again.'
        : message);
      stopPreview();
    }
  };

  const isCustomised = prefs.narratorId !== 'default' || prefs.voice !== 'auto';

  return (
    <div className="settings-narrator">
      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">Avatar</span>
          <span className="settings-row-desc">
            Presents workflow narration and Compare critiques. Changes apply the next time a narrator starts.
          </span>
        </div>
        <select
          className="settings-select"
          aria-label="Narrator avatar"
          value={prefs.narratorId}
          onChange={e => setPrefs({ narratorId: e.target.value })}
        >
          <option value="default">Deployment default ({defaultNarrator.label})</option>
          {GROUPS.map(group => {
            const items = narrators.filter(n => n.kind === group.kind
              && (group.kind !== 'photo' || (n.photoAvatarBaseModel === 'vasa-2') === Boolean(group.preview)));
            return items.length ? (
              <optgroup key={group.label} label={group.label}>
                {items.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
              </optgroup>
            ) : null;
          })}
        </select>
      </div>

      <div className="settings-row">
        <div className="settings-row-info">
          <span className="settings-row-label">Voice</span>
          <span className="settings-row-desc">
            {voiceLocked
              ? 'This custom avatar speaks with its own trained voice.'
              : 'Any Azure neural voice works with any avatar. Multilingual voices also read other languages.'}
          </span>
        </div>
        <select
          className="settings-select"
          aria-label="Narrator voice"
          value={prefs.voice}
          disabled={voiceLocked}
          onChange={e => setPrefs({ voice: e.target.value })}
        >
          <option value="auto">Avatar default ({NARRATOR_VOICES.find(v => v.id === resolved.preset.defaultVoice)?.label ?? resolved.preset.defaultVoice})</option>
          {NARRATOR_VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>

      <div className="settings-row settings-narrator-preview">
        <div className="settings-row-info">
          <span className="settings-row-label">Preview</span>
          <span className="settings-row-desc">
            {resolved.preset.note ?? 'Hear and see the selected narrator. Uses Azure AI Speech; the narrator is AI-generated.'}
          </span>
          {error && <span className="settings-narrator-error" role="alert">{error}</span>}
        </div>
        <div className="settings-narrator-actions">
          {isCustomised && (
            <button type="button" className="pane-btn" onClick={() => setPrefs({ narratorId: 'default', voice: 'auto' })}>
              <RotateCcw size={16} /> Reset
            </button>
          )}
          {previewing ? (
            <button type="button" className="pane-btn" onClick={stopPreview}>
              <Square size={16} /> {status === 'connecting' ? 'Connecting…' : 'Stop'}
            </button>
          ) : (
            <button type="button" className="pane-btn" onClick={startPreview}>
              <Play size={16} /> Preview narrator
            </button>
          )}
        </div>
      </div>

      <div className={`settings-narrator-stage${previewing ? ' is-active' : ''}`} aria-hidden={!previewing}>
        <video ref={videoRef} playsInline muted />
        <audio ref={audioRef} />
      </div>
    </div>
  );
}

export default NarratorSettings;
