// Narrator catalog and preference resolution (no network, no browser).
import assert from 'node:assert/strict';
import { STANDARD_NARRATORS, NARRATOR_VOICES, customNarrator, deploymentDefaultNarrator, listNarrators } from '../src/data/narrators';
import { resolveNarrator } from '../src/stores/narratorStore';

const ids = STANDARD_NARRATORS.map(n => n.id);
assert.equal(new Set(ids).size, ids.length, 'narrator ids are unique');
assert.ok(!STANDARD_NARRATORS.some(n => n.character === 'jeff' || /^(graceful|technical)-/.test(n.style) && n.character === 'lisa'),
  'batch-only / retiring avatars are not offered');
for (const n of STANDARD_NARRATORS) {
  if (n.kind === 'photo') {
    assert.equal(n.style, '', `${n.id}: photo avatars have no style`);
    assert.ok(n.photoAvatarBaseModel === 'vasa-1' || n.photoAvatarBaseModel === 'vasa-2', `${n.id}: photo base model`);
  } else {
    assert.ok(n.style && !n.photoAvatarBaseModel, `${n.id}: full-body avatars need a style and no photo model`);
  }
  assert.ok(n.defaultVoice.endsWith('Neural'), `${n.id}: default voice`);
}
assert.ok(STANDARD_NARRATORS.filter(n => n.photoAvatarBaseModel === 'vasa-2').every(n => n.note), 'preview photo avatars explain regional limits');
assert.equal(new Set(NARRATOR_VOICES.map(v => v.id)).size, NARRATOR_VOICES.length, 'voice ids are unique');

// Deployment default preserves today's behaviour.
const def = deploymentDefaultNarrator({});
assert.deepEqual([def.character, def.style, def.defaultVoice], ['lisa', 'casual-sitting', 'en-US-AvaMultilingualNeural']);
assert.equal(deploymentDefaultNarrator({ VITE_AVATAR_CHARACTER: 'meg', VITE_AVATAR_STYLE: 'formal' }).id, 'meg-formal');
assert.equal(deploymentDefaultNarrator({ VITE_AVATAR_VOICE: 'en-US-BrianMultilingualNeural' }).defaultVoice, 'en-US-BrianMultilingualNeural');

// Custom avatar appears only when configured.
assert.equal(customNarrator({}), null);
const custom = customNarrator({ VITE_AVATAR_CUSTOM_CHARACTER: 'arturo', VITE_AVATAR_CUSTOM_PHOTO_MODEL: 'vasa-1', VITE_AVATAR_CUSTOM_LABEL: 'Arturo' });
assert.deepEqual([custom?.label, custom?.customized, custom?.photoAvatarBaseModel], ['Arturo', true, 'vasa-1']);
const withCustom = listNarrators({ VITE_AVATAR_CUSTOM_CHARACTER: 'arturo' });
assert.equal(withCustom[0].id, 'custom', 'custom avatar is listed first');

// Resolution: preset, voice override, unknown id fallback.
const list = listNarrators({});
let r = resolveNarrator({ narratorId: 'default', voice: 'auto' }, list);
assert.deepEqual([r.character, r.style, r.voice], ['lisa', 'casual-sitting', 'en-US-AvaMultilingualNeural']);
r = resolveNarrator({ narratorId: 'photo-marcel', voice: 'auto' }, list);
assert.deepEqual([r.character, r.style, r.photoAvatarBaseModel, r.voice], ['marcel', '', 'vasa-2', 'en-US-AndrewMultilingualNeural']);
r = resolveNarrator({ narratorId: 'harry-business', voice: 'en-GB-OllieMultilingualNeural' }, list);
assert.deepEqual([r.character, r.style, r.voice], ['harry', 'business', 'en-GB-OllieMultilingualNeural']);
r = resolveNarrator({ narratorId: 'removed-avatar', voice: 'auto' }, list);
assert.equal(r.preset.id, 'lisa-casual-sitting', 'unknown saved id falls back to the deployment default');

console.log(`Narrator test passed: ${STANDARD_NARRATORS.length} presets, ${NARRATOR_VOICES.length} voices, defaults, custom avatar, resolution.`);
