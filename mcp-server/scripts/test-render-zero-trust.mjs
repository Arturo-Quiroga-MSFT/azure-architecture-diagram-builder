import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { computeLayout, reflowLayoutForPresentation } from '../dist/layoutEngine.js';
import { renderSvg } from '../dist/svgRenderer.js';
import { connections, groups, services } from './fixtures/zero-trust-scout.mjs';

const layout = reflowLayoutForPresentation(
  computeLayout(services, connections, groups, 'LR', {
    reserveEdgeLabelCorridors: true,
  }),
  { columnGap: 166 },
);
const svg = renderSvg(layout, 'Zero Trust Enterprise Network Architecture', {
  profile: 'technical',
  author: 'Arturo Quiroga',
  generatedBy: 'Azure Architecture Diagram Builder (Scout regression)',
});

function boxes(kind) {
  const pattern = kind === 'node'
    ? /<g class="node" data-service="([^"]+)"[\s\S]*?<!-- Card -->\s*<rect x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g
    : /<g class="edge-label"[^>]*>\s*<rect x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g;
  return [...svg.matchAll(pattern)].map(match => kind === 'node'
    ? { name: match[1], x: +match[2], y: +match[3], w: +match[4], h: +match[5] }
    : { x: +match[1], y: +match[2], w: +match[3], h: +match[4] });
}

function overlaps(left, right) {
  return left.x < right.x + right.w && left.x + left.w > right.x
    && left.y < right.y + right.h && left.y + left.h > right.y;
}

const nodes = boxes('node');
const labels = boxes('label');
assert.equal(nodes.length, 11);
assert.equal((svg.match(/<g class="edge"/g) ?? []).length, 15);
assert.equal(labels.length, 12);
assert.match(svg, /Monitor security/);
assert.match(svg, /posture · 4 targets/);
assert.match(svg, /class="edge-label" data-from="Microsoft Defender for Cloud"/);
assert.doesNotMatch(svg, /class="edge-label"[^>]*data-placement="detached"/);
const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
assert(viewBox, 'technical Scout render should expose a numeric viewBox');
assert(+viewBox[1] / +viewBox[2] <= 2.4, 'technical Scout render should fit a document-friendly aspect ratio');
const groupById = new Map(layout.groups.map(group => [group.id, group]));
const dmz = groupById.get('dmz');
const app = groupById.get('app');
const data = groupById.get('data');
const identity = groupById.get('identity');
const security = groupById.get('security');
assert(dmz && app && data && identity && security);
assert(dmz.x < app.x && app.x < data.x, 'primary row should read DMZ to application to data');
assert(identity.y > dmz.y + dmz.height, 'identity should sit below the primary row');
assert(security.y > app.y + app.height, 'security should sit below the primary row');
for (const label of labels) {
  for (const node of nodes) assert(!overlaps(label, node), `edge label must not overlap ${node.name}`);
}
for (let left = 0; left < labels.length; left++) {
  for (let right = left + 1; right < labels.length; right++) {
    assert(!overlaps(labels[left], labels[right]), 'edge labels must not overlap each other');
  }
}

if (process.env.ZERO_TRUST_OUTPUT_DIR) {
  mkdirSync(process.env.ZERO_TRUST_OUTPUT_DIR, { recursive: true });
  writeFileSync(join(process.env.ZERO_TRUST_OUTPUT_DIR, 'zero-trust-technical.svg'), svg);
}

console.log(`Zero-trust Scout render passed (${layout.width}x${layout.height}).`);