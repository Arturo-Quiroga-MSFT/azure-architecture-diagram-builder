import assert from 'node:assert/strict';

import { layoutArchitecture } from '../src/utils/layoutEngine';
import { preserveManualLayout, type LayoutNode } from '../src/utils/preserveManualLayout.ts';

// Mirrors how App.tsx turns a layout result into React Flow nodes: group nodes
// carry an absolute position plus style.width/height; service nodes carry a
// position relative to their parent group (parentNode) or absolute when ungrouped.
function toFlowNodes(result: ReturnType<typeof layoutArchitecture>): LayoutNode[] {
  const groups: LayoutNode[] = result.groups.map((g) => ({
    id: g.id,
    type: 'groupNode',
    position: g.position,
    data: { label: g.label },
    style: { width: g.width, height: g.height },
  }));
  const services: LayoutNode[] = result.services.map((s) => ({
    id: s.id,
    type: 'azureNode',
    position: s.position,
    parentNode: s.groupId || undefined,
    data: { label: s.name },
  }));
  return [...groups, ...services];
}

const NODE_W = 180;
const NODE_H = 136;

// Every grouped service must sit fully inside its parent's box. Returns the
// offending services with how far they escape on each side.
function escapes(nodes: LayoutNode[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Array<{ id: string; group: string; left: number; top: number; right: number; bottom: number }> = [];
  for (const n of nodes) {
    if (n.type === 'groupNode' || !n.parentNode) continue;
    const g = byId.get(n.parentNode);
    if (!g) { out.push({ id: n.id, group: `${n.parentNode} (missing)`, left: 0, top: 0, right: 0, bottom: 0 }); continue; }
    const gs = g.style as { width: number; height: number };
    const left = Math.max(0, -n.position.x);
    const top = Math.max(0, -n.position.y);
    const right = Math.max(0, n.position.x + NODE_W - gs.width);
    const bottom = Math.max(0, n.position.y + NODE_H - gs.height);
    if (left || top || right || bottom) out.push({ id: n.id, group: g.id, left, top, right, bottom });
  }
  return out;
}

// Group boxes must not overlap each other either, or icons look "outside".
function overlappingGroups(nodes: LayoutNode[]) {
  const groups = nodes.filter((n) => n.type === 'groupNode');
  const pairs: string[] = [];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i], b = groups[j];
      const as = a.style as { width: number; height: number }, bs = b.style as { width: number; height: number };
      if (a.position.x < b.position.x + bs.width && a.position.x + as.width > b.position.x
        && a.position.y < b.position.y + bs.height && a.position.y + as.height > b.position.y) {
        pairs.push(`${a.id} × ${b.id}`);
      }
    }
  }
  return pairs;
}

// ── BEFORE: a typical generated three-tier app ─────────────────────────────
const beforeGroups = [
  { id: 'web', label: 'Web Tier' },
  { id: 'app', label: 'Application Tier' },
  { id: 'data', label: 'Data Tier' },
];
const beforeServices = [
  { id: 'appgw', name: 'Application Gateway', groupId: 'web' },
  { id: 'webapp', name: 'App Service', groupId: 'web' },
  { id: 'func', name: 'Azure Functions', groupId: 'app' },
  { id: 'kv', name: 'Key Vault', groupId: 'app' },
  { id: 'sql', name: 'SQL Database', groupId: 'data' },
  { id: 'blob', name: 'Storage Account', groupId: 'data' },
];
const beforeConnections = [
  { from: 'appgw', to: 'webapp', label: 'Route HTTPS traffic' },
  { from: 'webapp', to: 'func', label: 'Invoke business APIs' },
  { from: 'func', to: 'sql', label: 'Read and write orders' },
  { from: 'func', to: 'blob', label: 'Store documents' },
  { from: 'func', to: 'kv', label: 'Fetch secrets' },
];
const before = toFlowNodes(layoutArchitecture(beforeServices, beforeConnections, beforeGroups, { direction: 'LR' }));
assert.deepEqual(escapes(before), [], 'baseline: a fresh generation keeps every icon inside its group');

// ── AFTER "apply WAF recommendations": new groups + services moved between groups.
// The AI regenerates IDs (as it often does) and re-homes Key Vault.
const afterGroups = [
  { id: 'g-edge', label: 'Edge & Ingress' },
  { id: 'g-web', label: 'Web Tier' },
  { id: 'g-app', label: 'Application Tier' },
  { id: 'g-data', label: 'Data Tier' },
  { id: 'g-sec', label: 'Security & Compliance' },
  { id: 'g-mon', label: 'Monitoring & Observability' },
];
const afterServices = [
  { id: 's-fd', name: 'Azure Front Door', groupId: 'g-edge' },
  { id: 's-appgw', name: 'Application Gateway', groupId: 'g-edge' },   // moved web → edge
  { id: 's-webapp', name: 'App Service', groupId: 'g-web' },
  { id: 's-func', name: 'Azure Functions', groupId: 'g-app' },
  { id: 's-redis', name: 'Azure Cache for Redis', groupId: 'g-data' },
  { id: 's-sql', name: 'SQL Database', groupId: 'g-data' },
  { id: 's-blob', name: 'Storage Account', groupId: 'g-data' },
  { id: 's-kv', name: 'Key Vault', groupId: 'g-sec' },                  // moved app → security
  { id: 's-entra', name: 'Microsoft Entra ID', groupId: 'g-sec' },
  { id: 's-monitor', name: 'Azure Monitor', groupId: 'g-mon' },
  { id: 's-logs', name: 'Log Analytics', groupId: 'g-mon' },
];
const afterConnections = [
  { from: 's-fd', to: 's-appgw', label: 'Route global traffic' },
  { from: 's-appgw', to: 's-webapp', label: 'Route HTTPS traffic' },
  { from: 's-webapp', to: 's-func', label: 'Invoke business APIs' },
  { from: 's-func', to: 's-redis', label: 'Cache hot reads' },
  { from: 's-func', to: 's-sql', label: 'Read and write orders' },
  { from: 's-func', to: 's-blob', label: 'Store documents' },
  { from: 's-func', to: 's-kv', label: 'Fetch secrets' },
  { from: 's-webapp', to: 's-monitor', label: 'Emit telemetry' },
  { from: 's-monitor', to: 's-logs', label: 'Store logs' },
];
const generated = toFlowNodes(layoutArchitecture(afterServices, afterConnections, afterGroups, { direction: 'LR' }));
assert.deepEqual(escapes(generated), [], 'the regenerated layout on its own is clean');

const merged = preserveManualLayout(before, generated);
const escaped = escapes(merged);
const overlaps = overlappingGroups(merged);

console.log('Escaped icons after applying recommendations:', escaped.length ? escaped : 'none');
console.log('Overlapping groups after applying recommendations:', overlaps.length ? overlaps : 'none');

assert.deepEqual(escaped, [], 'after a refinement, every icon must stay inside its (possibly new) group');
assert.deepEqual(overlaps, [], 'after a refinement, group boxes must not overlap');

// Services that stay in the same group keep the user's on-screen position.
function absoluteOf(nodes: LayoutNode[], id: string) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const n = byId.get(id)!;
  const p = n.parentNode ? byId.get(n.parentNode)! : undefined;
  return { x: (p?.position.x ?? 0) + n.position.x, y: (p?.position.y ?? 0) + n.position.y };
}
for (const [oldId, newId] of [['webapp', 's-webapp'], ['func', 's-func'], ['sql', 's-sql'], ['blob', 's-blob']]) {
  assert.deepEqual(absoluteOf(merged, newId), absoluteOf(before, oldId), `${oldId} stayed in its group, so its on-screen position must not change`);
}
// Groups that continue a previous group stay where the user left them.
for (const [oldId, newId] of [['web', 'g-web'], ['app', 'g-app'], ['data', 'g-data']]) {
  const oldGroup = before.find((n) => n.id === oldId)!;
  const newGroup = merged.find((n) => n.id === newId)!;
  assert.deepEqual(newGroup.position, oldGroup.position, `${oldId} is an existing group, so it must not move`);
}
// A re-homed service takes its generated place inside the new group, but keeps editor data.
const kv = merged.find((n) => n.id === 's-kv')!;
assert.equal(kv.parentNode, 'g-sec', 'Key Vault belongs to the new Security group');

// ── A user-dragged child that sits outside its group is pulled back in without moving on screen.
const stray: LayoutNode[] = [
  { id: 'grp', type: 'groupNode', position: { x: 400, y: 300 }, data: { label: 'App' }, style: { width: 500, height: 300 } },
  { id: 'svc', type: 'azureNode', position: { x: -120, y: -60 }, parentNode: 'grp', data: { label: 'App Service' } },
];
const strayResult = preserveManualLayout(stray, stray.map((n) => ({ ...n, position: { ...n.position } })));
assert.deepEqual(escapes(strayResult), [], 'a child left or above its group is brought inside');
assert.deepEqual(absoluteOf(strayResult, 'svc'), absoluteOf(stray, 'svc'), 'containment grows the group rather than moving the icon');

console.log('Refinement group-containment tests passed.');
