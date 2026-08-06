import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { computeLayout, reflowLayoutForPresentation } from '../dist/layoutEngine.js';
import { renderHtml } from '../dist/htmlRenderer.js';
import { renderSvg } from '../dist/svgRenderer.js';

const services = [
  ['Front Door', 'Azure Front Door', 'edge'],
  ['WAF Policy', 'Web Application Firewall', 'edge'],
  ['API Management', 'API Management', 'app'],
  ['Container Apps', 'Container Apps', 'app'],
  ['Container Registry', 'Container Registry', 'app'],
  ['SQL Database', 'SQL Database', 'data'],
  ['SQL Database Replica', 'SQL Database', 'data'],
  ['Redis Cache', 'Redis Cache', 'data'],
  ['Key Vault', 'Key Vault', 'security'],
  ['Entra ID', 'Microsoft Entra ID', 'security'],
  ['Azure Backup', 'Backup', 'security'],
  ['Virtual Network', 'Virtual Network', 'network'],
  ['Private Link', 'Private Link', 'network'],
  ['Private DNS', 'Azure DNS', 'network'],
  ['Log Analytics', 'Log Analytics', 'monitor'],
  ['Application Insights', 'Application Insights', 'monitor'],
  ['Azure Monitor', 'Azure Monitor', 'monitor'],
].map(([name, type, groupId]) => ({ name, type, groupId }));

const connections = [
  ['Front Door', 'WAF Policy'],
  ['WAF Policy', 'API Management'],
  ['API Management', 'Container Apps'],
  ['Container Apps', 'SQL Database'],
  ['Container Apps', 'Key Vault'],
  ['Container Apps', 'Container Registry'],
  ['API Management', 'Key Vault'],
  ['Container Apps', 'Log Analytics'],
  ['API Management', 'Application Insights'],
  ['Virtual Network', 'Private Link'],
  ['Private Link', 'SQL Database'],
  ['Private Link', 'Key Vault'],
  ['Private DNS', 'Private Link'],
  ['Entra ID', 'Container Apps'],
  ['Log Analytics', 'Azure Monitor'],
  ['Application Insights', 'Azure Monitor'],
  ['SQL Database', 'SQL Database Replica'],
  ['Container Apps', 'Redis Cache'],
  ['SQL Database', 'Azure Backup'],
].map(([from, to], index) => ({
  from,
  to,
  label: `Representative architecture flow ${index + 1}`,
  type: 'sync',
}));

const groups = [
  ['edge', 'Global Edge'],
  ['app', 'Application Tier'],
  ['data', 'Data Tier'],
  ['security', 'Identity and Security'],
  ['network', 'Private Networking'],
  ['monitor', 'Monitoring and Observability'],
].map(([id, label]) => ({ id, label }));

const layout = computeLayout(services, connections, groups, 'LR');
layout.nodes.forEach((node, index) => {
  if (index < 4) node.estimatedCost = 100 + index;
  else node.costRange = '$0-1000/mo';
});
const presentationLayout = reflowLayoutForPresentation(layout);

const shared = {
  theme: 'dark',
  author: 'Azure Architect',
  generatedBy: 'Azure Architecture Diagram Builder (hardened architecture workflow)',
  date: '2026-08-06',
};

const presentation = renderSvg(presentationLayout, 'Secure Zone-Redundant Web Application - East US 2', {
  ...shared,
  profile: 'presentation',
});
const technical = renderSvg(layout, 'Secure Zone-Redundant Web Application - East US 2', {
  ...shared,
  profile: 'technical',
});
const cost = renderSvg(layout, 'Secure Zone-Redundant Web Application - East US 2', {
  ...shared,
  profile: 'cost',
});

function viewBoxRatio(svg) {
  const match = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  assert(match, 'SVG should expose a numeric viewBox.');
  return Number(match[1]) / Number(match[2]);
}

assert.match(presentation, /data-render-profile="presentation"/);
assert.doesNotMatch(presentation, /class="node-cost/);
assert.doesNotMatch(presentation, /class="cost-summary"/);
assert(
  (presentation.match(/class="metadata-line"/g) ?? []).length >= 4,
  'Long metadata should wrap into additional lines.',
);
assert(
  viewBoxRatio(presentation) < viewBoxRatio(technical),
  'Presentation reflow should reduce an ultra-wide layout aspect ratio.',
);
assert(viewBoxRatio(presentation) >= 1.4 && viewBoxRatio(presentation) <= 2.4, 'Presentation aspect ratio should remain readable.');
assert.match(presentation, /class="edge edge-primary"/);
assert.match(presentation, /class="edge edge-supporting" opacity="0.58"/);
assert(
  (presentation.match(/<g class="edge-label">/g) ?? []).length <
    (technical.match(/<g class="edge-label">/g) ?? []).length,
  'Presentation should show fewer edge labels than technical output.',
);
assert((presentation.match(/<g class="edge-label">/g) ?? []).length <= 12, 'Presentation should cap visible edge labels.');

const overlaps = (left, right) => !(
  left.x + left.width <= right.x || right.x + right.width <= left.x ||
  left.y + left.height <= right.y || right.y + right.height <= left.y
);
const groupBoxes = presentationLayout.groups.map(group => ({
  x: group.x - 12,
  y: group.y - 36,
  width: group.width + 24,
  height: group.height + 48,
}));
for (let left = 0; left < groupBoxes.length; left++) {
  for (let right = left + 1; right < groupBoxes.length; right++) {
    assert(!overlaps(groupBoxes[left], groupBoxes[right]), 'Presentation groups must not overlap.');
  }
}
for (let left = 0; left < presentationLayout.nodes.length; left++) {
  for (let right = left + 1; right < presentationLayout.nodes.length; right++) {
    assert(!overlaps(presentationLayout.nodes[left], presentationLayout.nodes[right]), 'Presentation nodes must not overlap.');
  }
}

assert.match(technical, /data-render-profile="technical"/);
assert.doesNotMatch(technical, /class="node-cost/);

assert.match(cost, /data-render-profile="cost"/);
assert.match(cost, /class="node-cost/);
assert.match(cost, /class="cost-summary"/);

const presentationHtml = renderHtml(presentationLayout, 'Secure Web Application', {
  ...shared,
  profile: 'presentation',
});
const costHtml = renderHtml(layout, 'Secure Web Application', {
  ...shared,
  profile: 'cost',
});
assert.match(presentationHtml, /data-render-profile="presentation"/);
assert.match(presentationHtml, /const showCosts = false;/);
assert.match(costHtml, /data-render-profile="cost"/);
assert.match(costHtml, /const showCosts = true;/);

if (process.env.RENDER_PROFILE_OUTPUT_DIR) {
  mkdirSync(process.env.RENDER_PROFILE_OUTPUT_DIR, { recursive: true });
  writeFileSync(join(process.env.RENDER_PROFILE_OUTPUT_DIR, 'presentation.svg'), presentation);
  writeFileSync(join(process.env.RENDER_PROFILE_OUTPUT_DIR, 'technical.svg'), technical);
  writeFileSync(join(process.env.RENDER_PROFILE_OUTPUT_DIR, 'cost.svg'), cost);
  writeFileSync(join(process.env.RENDER_PROFILE_OUTPUT_DIR, 'presentation.html'), presentationHtml);
}

console.log('Render profile tests passed.');