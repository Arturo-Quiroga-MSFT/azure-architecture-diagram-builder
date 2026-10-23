import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatDuration, formatFilmed, isVideoManifest, mediaUrl, VIDEO_BASE_URL } from '../src/services/videoTour';

assert.equal(formatDuration(77.4), '1:17');
assert.equal(formatDuration(5), '0:05');
assert.equal(formatDuration(-3), '0:00');
assert.equal(formatFilmed({ filmed: '2026-10-23', appVersion: '2.1.14' }), 'Filmed Oct 23, 2026 on v2.1.14');
assert.equal(formatFilmed({ filmed: '2026-10-22', appVersion: null }), 'Filmed Oct 22, 2026');
assert.equal(formatFilmed({ filmed: null, appVersion: null }), '');

assert.equal(VIDEO_BASE_URL, '/media/videos', 'Default base URL serves public/media/videos in development');
assert.equal(mediaUrl('1_Prompt.mp4'), '/media/videos/1_Prompt.mp4');
assert.equal(mediaUrl('https://cdn.example.net/a.mp4'), 'https://cdn.example.net/a.mp4', 'Absolute URLs pass through');

assert.ok(isVideoManifest({ videos: [{ id: '01', src: 'a.mp4', chapters: [] }] }));
assert.ok(!isVideoManifest({ videos: [{ id: '01', chapters: [] }] }), 'A video needs a src');
assert.ok(!isVideoManifest({}), 'A manifest needs videos');
assert.ok(!isVideoManifest(null));

// Every "Watch" link in Help must point at a chapter key the catalog publishes.
const catalog = JSON.parse(readFileSync(new URL('../demo-videos/web/catalog.json', import.meta.url), 'utf8'));
const keys = new Set<string>();
for (const ep of catalog.episodes) for (const ch of ep.chapters) if (ch.key) {
  assert.ok(!keys.has(ch.key), `Duplicate topic key ${ch.key}`);
  keys.add(ch.key);
}
const help = readFileSync(new URL('../src/components/GuidedHelpPanel.tsx', import.meta.url), 'utf8');
const used = [...help.matchAll(/video: '([a-z0-9-]+)'/g)].map((m) => m[1]);
assert.ok(used.length >= 15, 'Help links its features to videos');
for (const key of used) assert.ok(keys.has(key), `Help links to unknown video topic "${key}"`);

const dirs = new Set(catalog.episodes.map((e: { dir: string }) => e.dir));
for (const p of catalog.playlists) for (const e of p.episodes) assert.ok(dirs.has(e), `Playlist ${p.id} lists unknown episode ${e}`);

console.log(`Video tour tests passed (${used.length} Help links, ${keys.size} topics).`);
