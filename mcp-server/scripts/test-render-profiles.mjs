import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { computeLayout, reflowLayoutForPresentation } from '../dist/layoutEngine.js';
import { renderHtml } from '../dist/htmlRenderer.js';
import { renderSvg, resolveRenderEdgeSemantics } from '../dist/svgRenderer.js';
import {
  connections as regionalConnections,
  groups as regionalGroups,
  services as regionalServices,
  sharedOptions as regionalOptions,
} from './fixtures/secure-multiregion-webapp.mjs';

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

function svgBoxes(svg, kind) {
  const pattern = kind === 'node'
    ? /<g class="node" data-service="([^"]+)"[\s\S]*?<!-- Card -->\s*<rect x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g
    : /<g class="edge-label"[^>]*>\s*<rect x="([0-9.]+)" y="([0-9.]+)" width="([0-9.]+)" height="([0-9.]+)"/g;
  return [...svg.matchAll(pattern)].map(match => kind === 'node'
    ? { name: match[1], x: Number(match[2]), y: Number(match[3]), width: Number(match[4]), height: Number(match[5]) }
    : { x: Number(match[1]), y: Number(match[2]), width: Number(match[3]), height: Number(match[4]) });
}

function assertNoSvgLabelNodeOverlaps(svg, profile) {
  const nodeBoxes = svgBoxes(svg, 'node');
  const labelBoxes = svgBoxes(svg, 'label');
  for (const label of labelBoxes) {
    for (const node of nodeBoxes) {
      assert(!overlaps(label, node), `${profile} edge labels must not overlap ${node.name}.`);
    }
  }
  for (let left = 0; left < labelBoxes.length; left++) {
    for (let right = left + 1; right < labelBoxes.length; right++) {
      assert(!overlaps(labelBoxes[left], labelBoxes[right]), `${profile} edge labels must not overlap each other.`);
    }
  }
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
  (presentation.match(/<g class="edge-label"/g) ?? []).length <
    (technical.match(/<g class="edge-label"/g) ?? []).length,
  'Presentation should show fewer edge labels than technical output.',
);
assert((presentation.match(/<g class="edge-label"/g) ?? []).length <= 12, 'Presentation should cap visible edge labels.');

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

const regionalLayout = computeLayout(regionalServices, regionalConnections, regionalGroups, 'LR');
const fixedCosts = new Map([
  ['Primary API Management - East US 2', 147],
  ['Primary SQL Database - East US 2', 145],
  ['Primary Redis Cache - East US 2', 40.15],
  ['Secondary API Management - Central US', 147],
  ['Secondary SQL Database - Central US', 145],
  ['Secondary Redis Cache - Central US', 40.15],
]);
regionalLayout.nodes.forEach(node => {
  if (fixedCosts.has(node.name)) node.estimatedCost = fixedCosts.get(node.name);
  else node.costRange = '$0-1000/mo';
});
const regionalPresentationLayout = reflowLayoutForPresentation(regionalLayout);
const regionalPresentation = renderSvg(regionalPresentationLayout, 'Secure Zone-Redundant Azure Web Application', {
  ...regionalOptions,
  profile: 'presentation',
});
const regionalTechnical = renderSvg(regionalLayout, 'Secure Zone-Redundant Azure Web Application', {
  ...regionalOptions,
  profile: 'technical',
});
const regionalCost = renderSvg(regionalPresentationLayout, 'Secure Zone-Redundant Azure Web Application', {
  ...regionalOptions,
  profile: 'cost',
});
const regionalPresentationHtml = renderHtml(regionalPresentationLayout, 'Secure Zone-Redundant Azure Web Application', {
  ...regionalOptions,
  profile: 'presentation',
});
const regionalCostHtml = renderHtml(regionalPresentationLayout, 'Secure Zone-Redundant Azure Web Application', {
  ...regionalOptions,
  profile: 'cost',
});
const presentationSemantics = resolveRenderEdgeSemantics(regionalPresentationLayout, 'presentation');
const technicalSemantics = resolveRenderEdgeSemantics(regionalLayout, 'technical');
const costSemantics = resolveRenderEdgeSemantics(regionalPresentationLayout, 'cost');

assert.equal(regionalLayout.nodes.length, 29);
assert.equal(regionalLayout.edges.length, 46);
assert.equal(regionalLayout.groups.length, 3);
assert(
  viewBoxRatio(regionalPresentation) <= 2.2,
  'Three-group multi-region presentation output should fit a document-friendly aspect ratio.',
);
assert(viewBoxRatio(regionalCost) <= 2.2, 'Cost mode should reuse the document-friendly regional composition.');
for (let left = 0; left < regionalPresentationLayout.nodes.length; left++) {
  for (let right = left + 1; right < regionalPresentationLayout.nodes.length; right++) {
    assert(
      !overlaps(regionalPresentationLayout.nodes[left], regionalPresentationLayout.nodes[right]),
      'Multi-region presentation nodes must not overlap.',
    );
  }
}
const regionalGroupBoxes = regionalPresentationLayout.groups.map(group => ({
  x: group.x - 12,
  y: group.y - 36,
  width: group.width + 24,
  height: group.height + 48,
}));
for (let left = 0; left < regionalGroupBoxes.length; left++) {
  for (let right = left + 1; right < regionalGroupBoxes.length; right++) {
    assert(!overlaps(regionalGroupBoxes[left], regionalGroupBoxes[right]), 'Multi-region presentation groups must not overlap.');
  }
}
for (const [from, to] of [
  ['Global Front Door Premium', 'Primary API Management - East US 2'],
  ['Primary API Management - East US 2', 'Primary Container Apps Environment - East US 2'],
  ['Primary Container Apps Environment - East US 2', 'Primary SQL Database - East US 2'],
  ['Primary Container Apps Environment - East US 2', 'Primary Redis Cache - East US 2'],
]) {
  assert.match(
    regionalPresentation,
    new RegExp(`class="edge edge-primary"[^>]*data-from="${from}" data-to="${to}"`),
    `${from} -> ${to} should be part of the primary request path.`,
  );
}
assert.doesNotMatch(
  regionalPresentation,
  /class="edge edge-primary"[^>]*data-from="Edge WAF Policy" data-to="Global Front Door Premium"/,
  'The WAF association should not be rendered as the primary traffic path.',
);
assert.match(regionalPresentation, /class="edge edge-policy-association"/);
assert.match(regionalPresentation, /WAF policy association/);
assert.equal((regionalPresentation.match(/class="edge edge-primary"/g) ?? []).length, 4);
assert.equal((regionalTechnical.match(/<g class="edge-label"/g) ?? []).length, 46);
assert.equal(presentationSemantics.primary.size, 4);
assert.equal(presentationSemantics.labeled.size, 12);
assert.equal(technicalSemantics.labeled.size, 46);
assert.equal(costSemantics.primary.size, 4);
assert.equal(costSemantics.labeled.size, 12);
assert(
  (regionalCost.match(/<g class="edge-label"/g) ?? []).length <
    (regionalTechnical.match(/<g class="edge-label"/g) ?? []).length,
  'Cost mode should suppress supporting edge labels so pricing remains the visual priority.',
);
assert((regionalCost.match(/<g class="edge-label"/g) ?? []).length <= 12);
assert.equal((regionalCost.match(/class="node-cost/g) ?? []).length, 29);
assert.match(regionalCost, /Fixed priced baseline:/);
assert.match(regionalCost, /Excludes 23 usage-based or ranged items shown on nodes\./);
assert.match(regionalPresentationHtml, /const edgeSemantics = \{"focusProfile":true/);
assert.match(regionalPresentationHtml, /WAF policy association/);
assert.match(regionalCostHtml, /Fixed priced baseline: ~\$664\/mo/);
assert.match(regionalCostHtml, /const showCosts = true;/);
assertNoSvgLabelNodeOverlaps(regionalPresentation, 'Presentation');
assertNoSvgLabelNodeOverlaps(regionalCost, 'Cost');

if (process.env.RENDER_PROFILE_OUTPUT_DIR) {
  mkdirSync(process.env.RENDER_PROFILE_OUTPUT_DIR, { recursive: true });
  writeFileSync(join(process.env.RENDER_PROFILE_OUTPUT_DIR, 'presentation.svg'), presentation);
  writeFileSync(join(process.env.RENDER_PROFILE_OUTPUT_DIR, 'technical.svg'), technical);
  writeFileSync(join(process.env.RENDER_PROFILE_OUTPUT_DIR, 'cost.svg'), cost);
  writeFileSync(join(process.env.RENDER_PROFILE_OUTPUT_DIR, 'presentation.html'), presentationHtml);
  writeFileSync(join(process.env.RENDER_PROFILE_OUTPUT_DIR, 'regional-presentation.svg'), regionalPresentation);
  writeFileSync(join(process.env.RENDER_PROFILE_OUTPUT_DIR, 'regional-technical.svg'), regionalTechnical);
  writeFileSync(join(process.env.RENDER_PROFILE_OUTPUT_DIR, 'regional-cost.svg'), regionalCost);
  writeFileSync(join(process.env.RENDER_PROFILE_OUTPUT_DIR, 'regional-presentation.html'), regionalPresentationHtml);
  writeFileSync(join(process.env.RENDER_PROFILE_OUTPUT_DIR, 'regional-cost.html'), regionalCostHtml);
}

console.log('Render profile tests passed.');