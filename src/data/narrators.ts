// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Narrator catalog for the talking-avatar features (workflow narration and the
 * Compare "Present" critiques).
 *
 * Only avatars that work with the real-time (WebRTC) avatar API are listed:
 * standard full-body avatars and photo avatars. Lisa's graceful/technical
 * styles are batch-only and retire in December 2026, so they are excluded.
 * Source: https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech-avatar/standard-avatars
 *
 * A custom avatar (e.g. the presenter's own likeness) can be added without a
 * code change via VITE_AVATAR_CUSTOM_CHARACTER (see customNarrator below).
 */

export type NarratorKind = 'full-body' | 'photo' | 'custom';

export interface NarratorPreset {
  id: string;
  label: string;
  kind: NarratorKind;
  /** Avatar character id passed to AvatarConfig. */
  character: string;
  /** Avatar style; empty for photo avatars. */
  style: string;
  /** Photo-avatar base model ('vasa-1' GA, 'vasa-2' preview). */
  photoAvatarBaseModel?: string;
  /** True for a custom (trained) avatar. */
  customized?: boolean;
  /** Use the voice trained with a custom video avatar ("voice sync for avatar"). */
  useBuiltInVoice?: boolean;
  /** Voice used when the user keeps "Avatar default". */
  defaultVoice: string;
  /** Shown as a hint, e.g. preview or regional availability. */
  note?: string;
}

const AVA = 'en-US-AvaMultilingualNeural';
const ANDREW = 'en-US-AndrewMultilingualNeural';
const EMMA = 'en-US-EmmaMultilingualNeural';
const BRIAN = 'en-US-BrianMultilingualNeural';

const VASA2_NOTE = 'Preview photo avatar, available only when the Speech resource is in West US 2, Central India, Southeast Asia or Sweden Central.';

const fullBody = (character: string, style: string, name: string, voice: string): NarratorPreset => ({
  id: `${character}-${style}`, label: `${name} · ${style.replace('-', ', ')}`, kind: 'full-body', character, style, defaultVoice: voice,
});

const photo = (character: string, name: string, voice: string, model: 'vasa-1' | 'vasa-2' = 'vasa-1'): NarratorPreset => ({
  id: `photo-${character}`,
  label: model === 'vasa-2' ? `${name} · photo (preview)` : `${name} · photo`,
  kind: 'photo', character, style: '', photoAvatarBaseModel: model, defaultVoice: voice,
  note: model === 'vasa-2' ? VASA2_NOTE : undefined,
});

export const STANDARD_NARRATORS: NarratorPreset[] = [
  fullBody('lisa', 'casual-sitting', 'Lisa', AVA),
  fullBody('harry', 'business', 'Harry', ANDREW),
  fullBody('harry', 'casual', 'Harry', ANDREW),
  fullBody('harry', 'youthful', 'Harry', ANDREW),
  fullBody('lori', 'casual', 'Lori', EMMA),
  fullBody('lori', 'graceful', 'Lori', EMMA),
  fullBody('lori', 'formal', 'Lori', EMMA),
  fullBody('max', 'business', 'Max', BRIAN),
  fullBody('max', 'casual', 'Max', BRIAN),
  fullBody('max', 'formal', 'Max', BRIAN),
  fullBody('meg', 'business', 'Meg', AVA),
  fullBody('meg', 'casual', 'Meg', AVA),
  fullBody('meg', 'formal', 'Meg', AVA),
  photo('adrian', 'Adrian', ANDREW),
  photo('amara', 'Amara', AVA),
  photo('carlos', 'Carlos', BRIAN),
  photo('clara', 'Clara', EMMA),
  photo('diego', 'Diego', ANDREW),
  photo('elise', 'Elise', AVA),
  photo('isabella', 'Isabella', EMMA),
  photo('marcus', 'Marcus', BRIAN),
  photo('matteo', 'Matteo', ANDREW),
  photo('rahul', 'Rahul', BRIAN),
  photo('sakura', 'Sakura', AVA),
  photo('zoe', 'Zoe', EMMA),
  photo('george', 'George', BRIAN, 'vasa-2'),
  photo('marcel', 'Marcel', ANDREW, 'vasa-2'),
  photo('leonie', 'Leonie', EMMA, 'vasa-2'),
];

export interface NarratorVoice {
  id: string;
  label: string;
}

export const NARRATOR_VOICES: NarratorVoice[] = [
  { id: AVA, label: 'Ava (US, female, multilingual)' },
  { id: EMMA, label: 'Emma (US, female, multilingual)' },
  { id: ANDREW, label: 'Andrew (US, male, multilingual)' },
  { id: BRIAN, label: 'Brian (US, male, multilingual)' },
  { id: 'en-GB-AdaMultilingualNeural', label: 'Ada (UK, female, multilingual)' },
  { id: 'en-GB-OllieMultilingualNeural', label: 'Ollie (UK, male, multilingual)' },
  { id: 'en-AU-NatashaNeural', label: 'Natasha (Australia, female)' },
  { id: 'en-AU-WilliamNeural', label: 'William (Australia, male)' },
  { id: 'en-IN-NeerjaNeural', label: 'Neerja (India, female)' },
  { id: 'en-IN-PrabhatNeural', label: 'Prabhat (India, male)' },
  { id: 'fr-CA-SylvieNeural', label: 'Sylvie (Canadian French, female)' },
  { id: 'es-MX-DaliaNeural', label: 'Dalia (Mexican Spanish, female)' },
];

export type NarratorEnv = Record<string, string | boolean | undefined>;

/** import.meta.env is only defined under Vite; tests and scripts get an empty env. */
const viteEnv = (): NarratorEnv => (import.meta as { env?: NarratorEnv }).env ?? {};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Optional custom avatar configured at build time (e.g. the presenter's own likeness). */
export function customNarrator(env: NarratorEnv = viteEnv()): NarratorPreset | null {
  const character = str(env.VITE_AVATAR_CUSTOM_CHARACTER);
  if (!character) return null;
  const photoModel = str(env.VITE_AVATAR_CUSTOM_PHOTO_MODEL);
  return {
    id: 'custom',
    label: str(env.VITE_AVATAR_CUSTOM_LABEL) || `${character} · custom`,
    kind: 'custom',
    character,
    style: str(env.VITE_AVATAR_CUSTOM_STYLE),
    photoAvatarBaseModel: photoModel || undefined,
    customized: true,
    useBuiltInVoice: str(env.VITE_AVATAR_CUSTOM_BUILTIN_VOICE).toLowerCase() === 'true',
    defaultVoice: str(env.VITE_AVATAR_CUSTOM_VOICE) || AVA,
  };
}

/** Deployment default: VITE_AVATAR_* env vars, falling back to Lisa casual-sitting. */
export function deploymentDefaultNarrator(env: NarratorEnv = viteEnv()): NarratorPreset {
  const character = str(env.VITE_AVATAR_CHARACTER) || 'lisa';
  const style = str(env.VITE_AVATAR_STYLE) || (character === 'lisa' ? 'casual-sitting' : '');
  const voice = str(env.VITE_AVATAR_VOICE);
  const match = STANDARD_NARRATORS.find(n => n.character === character && n.style === style);
  if (match) return voice ? { ...match, defaultVoice: voice } : match;
  return {
    id: 'deployment-default', label: `${character}${style ? ` · ${style}` : ''}`,
    kind: 'full-body', character, style, defaultVoice: voice || AVA,
  };
}

/** All narrators offered to the user: custom (if configured), deployment default, then the standard catalog. */
export function listNarrators(env: NarratorEnv = viteEnv()): NarratorPreset[] {
  const list = [...STANDARD_NARRATORS];
  const deploymentDefault = deploymentDefaultNarrator(env);
  if (deploymentDefault.id === 'deployment-default') list.unshift(deploymentDefault);
  const custom = customNarrator(env);
  if (custom) list.unshift(custom);
  return list;
}
