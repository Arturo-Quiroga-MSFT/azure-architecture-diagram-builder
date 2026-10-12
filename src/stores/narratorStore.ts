// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Narrator preferences — which talking avatar and voice present workflow
 * narration and Compare critiques. Persists to localStorage; defaults to the
 * deployment's VITE_AVATAR_* configuration so existing behaviour is unchanged.
 */

import { useEffect, useState } from 'react';
import { deploymentDefaultNarrator, listNarrators, type NarratorPreset } from '../data/narrators';

export interface NarratorPrefs {
  /** Narrator preset id, or 'default' for the deployment default. */
  narratorId: string;
  /** Voice name, or 'auto' to use the narrator's default voice. */
  voice: string;
}

/** Everything AvatarPresenter needs to start a session. */
export interface ResolvedNarrator {
  preset: NarratorPreset;
  character: string;
  style: string;
  voice: string;
  photoAvatarBaseModel?: string;
  customized?: boolean;
  useBuiltInVoice?: boolean;
}

const STORAGE_KEY = 'azure-diagrams-narrator-prefs';
const DEFAULT_PREFS: NarratorPrefs = { narratorId: 'default', voice: 'auto' };

function loadPrefs(): NarratorPrefs {
  if (typeof globalThis.localStorage?.getItem !== 'function') return { ...DEFAULT_PREFS };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        narratorId: typeof parsed.narratorId === 'string' ? parsed.narratorId : DEFAULT_PREFS.narratorId,
        voice: typeof parsed.voice === 'string' ? parsed.voice : DEFAULT_PREFS.voice,
      };
    }
  } catch (e) {
    console.warn('Failed to load narrator prefs:', e);
  }
  return { ...DEFAULT_PREFS };
}

function savePrefs(prefs: NarratorPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Failed to save narrator prefs:', e);
  }
}

let currentPrefs: NarratorPrefs = loadPrefs();
const listeners: Set<(prefs: NarratorPrefs) => void> = new Set();

/** Resolve prefs to a concrete avatar configuration. Unknown ids fall back to the deployment default. */
export function resolveNarrator(prefs: NarratorPrefs = currentPrefs, narrators: NarratorPreset[] = listNarrators()): ResolvedNarrator {
  const preset = (prefs.narratorId !== 'default' && narrators.find(n => n.id === prefs.narratorId))
    || deploymentDefaultNarrator();
  return {
    preset,
    character: preset.character,
    style: preset.style,
    voice: prefs.voice && prefs.voice !== 'auto' ? prefs.voice : preset.defaultVoice,
    photoAvatarBaseModel: preset.photoAvatarBaseModel,
    customized: preset.customized,
    useBuiltInVoice: preset.useBuiltInVoice,
  };
}

/** Options for `new AvatarPresenter({...})` reflecting the user's current narrator choice. */
export function narratorAvatarOptions() {
  const { character, style, voice, photoAvatarBaseModel, customized, useBuiltInVoice } = resolveNarrator();
  return { character, style, voice, photoAvatarBaseModel, customized, useBuiltInVoice };
}

export function getNarratorPrefs(): NarratorPrefs {
  return { ...currentPrefs };
}

export function updateNarratorPrefs(updates: Partial<NarratorPrefs>): void {
  currentPrefs = { ...currentPrefs, ...updates };
  savePrefs(currentPrefs);
  listeners.forEach(listener => listener(currentPrefs));
}

export function useNarratorPrefs(): [NarratorPrefs, (updates: Partial<NarratorPrefs>) => void] {
  const [prefs, setPrefs] = useState<NarratorPrefs>(currentPrefs);
  useEffect(() => {
    const listener = (next: NarratorPrefs) => setPrefs(next);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return [prefs, updateNarratorPrefs];
}
