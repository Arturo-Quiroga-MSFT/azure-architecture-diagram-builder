// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Layout Engine for SpecKit Diagram Rendering
 *
 * Uses dagre to compute hierarchical graph layout for Azure architecture
 * diagrams. Produces positioned nodes and routed edges ready for SVG or
 * HTML rendering.
 */

import dagre from 'dagre';
import { resolveServiceName, SERVICE_CATALOG } from './serviceCatalog.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface DiagramService {
  name: string;
  type: string;
  description?: string;
  groupId?: string;
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
  type?: 'sync' | 'async' | 'optional';
}

export interface DiagramGroup {
  id: string;
  label: string;
}

export interface PositionedNode {
  name: string;
  type: string;
  description: string;
  category: string;
  groupId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  textColor: string;
  /** Best-effort estimated monthly cost (total, quantity-adjusted). Optional. */
  estimatedCost?: number;
  /** Currency code for estimatedCost (e.g. "USD"). Optional. */
  costCurrency?: string;
  /** Curated catalog cost range, shown when no firm numeric estimate exists. */
  costRange?: string;
  /** True when the service bills by usage (per-token/-transaction/-GB). */
  isUsageBased?: boolean;
}

export interface PositionedEdge {
  from: string;
  to: string;
  label: string;
  type: string;
  points: Array<{ x: number; y: number }>;
}

export interface PositionedGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  groups: PositionedGroup[];
  width: number;
  height: number;
  /** Layout flow direction, used by the renderer for orthogonal edge routing. */
  direction: 'TB' | 'LR';
}

// ── Azure category colors ──────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'ai + machine learning':  { bg: '#E8F0FE', border: '#4285F4', text: '#1A73E8' },
  'app services':           { bg: '#E8F4FD', border: '#0078D4', text: '#004578' },
  'compute':                { bg: '#E8F4FD', border: '#0078D4', text: '#004578' },
  'databases':              { bg: '#E6F4EA', border: '#0B8043', text: '#0B6B3A' },
  'storage':                { bg: '#E6F4EA', border: '#137333', text: '#0B6B3A' },
  'networking':             { bg: '#FFF3E0', border: '#E65100', text: '#BF360C' },
  'analytics':              { bg: '#F3E8FD', border: '#7B1FA2', text: '#6A1B9A' },
  'containers':             { bg: '#E0F7FA', border: '#00838F', text: '#006064' },
  'integration':            { bg: '#FCE4EC', border: '#C62828', text: '#B71C1C' },
  'identity':               { bg: '#FFF8E1', border: '#F9A825', text: '#F57F17' },
  'management + governance':{ bg: '#F1F8E9', border: '#558B2F', text: '#33691E' },
  'iot':                    { bg: '#E0F2F1', border: '#00695C', text: '#004D40' },
  'monitor':                { bg: '#EDE7F6', border: '#5E35B1', text: '#4527A0' },
  'security':               { bg: '#FFEBEE', border: '#C62828', text: '#B71C1C' },
  'web':                    { bg: '#E3F2FD', border: '#1565C0', text: '#0D47A1' },
  'other':                  { bg: '#F5F5F5', border: '#616161', text: '#424242' },
};

const GROUP_COLORS = [
  { bg: '#F0F6FF', border: '#0078D4' },   // Azure blue
  { bg: '#F0FFF0', border: '#00B294' },   // Azure green
  { bg: '#FFF8F0', border: '#FFB900' },   // Azure yellow
  { bg: '#F8F0FF', border: '#8764B8' },   // Azure purple
  { bg: '#FFF0F0', border: '#D13438' },   // Azure red
  { bg: '#F0FFFF', border: '#038387' },   // Azure teal
];

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS['other'];
}

// Stable group header color: map common tier/label keywords to a fixed palette
// entry so a given tier (e.g. "Data Tier") keeps the same color across diagrams
// regardless of its position. Falls back to index-based assignment for labels
// that don't match a known tier keyword.
function groupColorFor(label: string, idx: number): { bg: string; border: string } {
  const l = label.toLowerCase();
  if (/identity|entra|\baad\b|auth/.test(l)) return GROUP_COLORS[2];              // yellow
  if (/data|database|storage|\bsql\b|cosmos|cache|persist/.test(l)) return GROUP_COLORS[1]; // green
  if (/security|\bops\b|monitor|governance|observ|backup|defender|sentinel/.test(l)) return GROUP_COLORS[4]; // red
  if (/\bapi\b|gateway|apim|integration|messaging|event|queue|bus/.test(l)) return GROUP_COLORS[5]; // teal
  if (/edge|ingress|front|\bcdn\b|\bdns\b|\bwaf\b|perimeter|network/.test(l)) return GROUP_COLORS[0]; // blue
  if (/app|compute|web|frontend|backend|application|service|processing|tier/.test(l)) return GROUP_COLORS[3]; // purple
  return GROUP_COLORS[idx % GROUP_COLORS.length];
}

// ── Layout computation ─────────────────────────────────────────────────

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;
const PADDING = 40;

function computeFlatLayout(
  services: DiagramService[],
  connections: DiagramConnection[],
  groups: DiagramGroup[],
  direction: 'TB' | 'LR' = 'TB',
): LayoutResult {
  const g = new dagre.graphlib.Graph({ compound: true });

  // Adaptive spacing: scale up for larger graphs and longer edge labels so
  // label backgrounds don't collide and edges have room to route cleanly.
  const svcCount = services.length;
  const maxLabelLen = connections.reduce(
    (m, c) => Math.max(m, (c.label ?? '').length),
    0,
  );
  const sizeBoost = svcCount >= 16 ? 1.25 : svcCount >= 10 ? 1.1 : 1.0;
  const labelBoost = maxLabelLen >= 40 ? 1.2 : maxLabelLen >= 25 ? 1.1 : 1.0;
  const nodesep = Math.round(60 * sizeBoost * labelBoost);
  const ranksep = Math.round(85 * sizeBoost * labelBoost);
  const edgesep = Math.round(30 * labelBoost);

  g.setGraph({
    rankdir: direction,
    nodesep,
    ranksep,
    edgesep,
    marginx: PADDING,
    marginy: PADDING,
    // longest-path aligns tiered architectures (edge→app→data) onto clean ranks
    // and empirically produces far fewer edge crossings than network-simplex /
    // tight-tree for these graphs.
    ranker: 'longest-path',
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Add group nodes (compound parents)
  const groupMap = new Map(groups.map(gr => [gr.id, gr]));
  for (const group of groups) {
    g.setNode(`group-${group.id}`, {
      label: group.label,
      clusterLabelPos: 'top',
      style: 'fill: transparent',
    });
  }

  // Add service nodes
  const serviceCategories = new Map<string, string>();
  for (const svc of services) {
    const category = resolveCategory(svc.type);
    serviceCategories.set(svc.name, category);

    g.setNode(svc.name, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      label: svc.name,
    });

    // Parent to group if specified
    if (svc.groupId && groupMap.has(svc.groupId)) {
      g.setParent(svc.name, `group-${svc.groupId}`);
    }
  }

  // Add edges
  const serviceNames = new Set(services.map(s => s.name));
  for (const conn of connections) {
    if (serviceNames.has(conn.from) && serviceNames.has(conn.to)) {
      g.setEdge(conn.from, conn.to, {
        label: conn.label ?? '',
        minlen: 1,
      });
    }
  }

  // Run layout
  dagre.layout(g);

  // Extract positioned nodes
  const positionedNodes: PositionedNode[] = services.map(svc => {
    const node = g.node(svc.name);
    const category = serviceCategories.get(svc.name) ?? 'other';
    const colors = getCategoryColor(category);

    return {
      name: svc.name,
      type: svc.type,
      description: svc.description ?? '',
      category,
      groupId: svc.groupId ?? null,
      x: node.x - NODE_WIDTH / 2,
      y: node.y - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      color: colors.border,
      textColor: colors.text,
    };
  });

  // Extract positioned edges
  const positionedEdges: PositionedEdge[] = connections
    .filter(c => serviceNames.has(c.from) && serviceNames.has(c.to))
    .map(conn => {
      const edge = g.edge(conn.from, conn.to);
      return {
        from: conn.from,
        to: conn.to,
        label: conn.label ?? '',
        type: conn.type ?? 'sync',
        points: edge?.points ?? [],
      };
    });

  // Extract positioned groups
  const positionedGroups: PositionedGroup[] = groups.map((group, idx) => {
    const gNode = g.node(`group-${group.id}`);
    const groupColor = groupColorFor(group.label, idx);
    if (!gNode) {
      return {
        id: group.id,
        label: group.label,
        x: 0, y: 0, width: 0, height: 0,
        color: groupColor.border,
      };
    }
    return {
      id: group.id,
      label: group.label,
      x: gNode.x - (gNode.width ?? 200) / 2,
      y: gNode.y - (gNode.height ?? 100) / 2,
      width: gNode.width ?? 200,
      height: gNode.height ?? 100,
      color: groupColor.border,
    };
  }).filter(g => g.width > 0);

  // Compute canvas bounds
  const graphInfo = g.graph();
  const width = (graphInfo.width ?? 800) + PADDING * 2;
  const height = (graphInfo.height ?? 600) + PADDING * 2;

  return { nodes: positionedNodes, edges: positionedEdges, groups: positionedGroups, width, height, direction };
}

// ── Grouped (two-level) layout ─────────────────────────────────────────
// Lays out each group's members independently, then places the groups as
// non-overlapping meta-nodes. Combined with the renderer's orthogonal router
// (which only needs edge endpoints), this produces clean lane-based diagrams
// without the interleaved/overlapping group boxes the compound layout caused.

const GROUP_INNER_PAD = 16;
const GROUP_HEADER_H = 28;

interface Rect { x: number; y: number; width: number; height: number }

/** Pick border anchor points on two rects that suit the flow direction. */
function borderAnchor(a: Rect, b: Rect, direction: 'TB' | 'LR'): { s: { x: number; y: number }; t: { x: number; y: number } } {
  const acx = a.x + a.width / 2, acy = a.y + a.height / 2;
  const bcx = b.x + b.width / 2, bcy = b.y + b.height / 2;
  if (direction === 'LR') {
    if (bcx >= acx) return { s: { x: a.x + a.width, y: acy }, t: { x: b.x, y: bcy } };
    return { s: { x: a.x, y: acy }, t: { x: b.x + b.width, y: bcy } };
  }
  if (bcy >= acy) return { s: { x: acx, y: a.y + a.height }, t: { x: bcx, y: b.y } };
  return { s: { x: acx, y: a.y }, t: { x: bcx, y: b.y + b.height } };
}

/** Lay out one group's members; return positions normalized to (0,0) + size. */
function subLayoutGroup(
  members: DiagramService[],
  connections: DiagramConnection[],
  direction: 'TB' | 'LR',
): { pos: Map<string, { x: number; y: number }>; width: number; height: number } {
  const memberSet = new Set(members.map(m => m.name));
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 45, ranksep: 65, marginx: 0, marginy: 0, ranker: 'network-simplex' });
  g.setDefaultEdgeLabel(() => ({}));
  for (const m of members) g.setNode(m.name, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const c of connections) {
    if (memberSet.has(c.from) && memberSet.has(c.to) && c.from !== c.to) g.setEdge(c.from, c.to, {});
  }
  dagre.layout(g);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const raw = new Map<string, { x: number; y: number }>();
  for (const m of members) {
    const n = g.node(m.name);
    const x = n.x - NODE_WIDTH / 2, y = n.y - NODE_HEIGHT / 2;
    raw.set(m.name, { x, y });
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + NODE_WIDTH); maxY = Math.max(maxY, y + NODE_HEIGHT);
  }
  const pos = new Map<string, { x: number; y: number }>();
  for (const [name, p] of raw) pos.set(name, { x: p.x - minX, y: p.y - minY });
  return { pos, width: maxX - minX, height: maxY - minY };
}

function computeGroupedLayout(
  services: DiagramService[],
  connections: DiagramConnection[],
  groups: DiagramGroup[],
  direction: 'TB' | 'LR',
): LayoutResult | null {
  const groupMap = new Map(groups.map(g => [g.id, g]));
  const validGroups = groups.filter(g => services.some(s => s.groupId === g.id));
  if (validGroups.length === 0) return null;

  // Phase 1: sub-layout each group's members.
  const sub = new Map<string, { pos: Map<string, { x: number; y: number }>; width: number; height: number }>();
  for (const grp of validGroups) {
    const members = services.filter(s => s.groupId === grp.id);
    sub.set(grp.id, subLayoutGroup(members, connections, direction));
  }
  const ungrouped = services.filter(s => !s.groupId || !groupMap.has(s.groupId));

  // Phase 2: lay out groups (and ungrouped nodes) as meta-nodes.
  const metaKey = (name: string): string => {
    const svc = services.find(s => s.name === name);
    return svc && svc.groupId && groupMap.has(svc.groupId) ? `g:${svc.groupId}` : `n:${name}`;
  };
  const mg = new dagre.graphlib.Graph();
  const sizeBoost = services.length >= 16 ? 1.2 : 1.0;
  mg.setGraph({
    rankdir: direction,
    nodesep: Math.round(70 * sizeBoost),
    ranksep: Math.round(110 * sizeBoost),
    marginx: PADDING,
    marginy: PADDING,
    ranker: 'network-simplex',
  });
  mg.setDefaultEdgeLabel(() => ({}));
  // Effective group width fits both the member layout and the header label.
  const groupW = new Map<string, number>();
  for (const grp of validGroups) {
    const s = sub.get(grp.id)!;
    const headerW = grp.label.length * 6.8 + 28;
    const effW = Math.max(s.width, headerW);
    groupW.set(grp.id, effW);
    mg.setNode(`g:${grp.id}`, {
      width: effW + GROUP_INNER_PAD * 2,
      height: s.height + GROUP_INNER_PAD * 2 + GROUP_HEADER_H,
    });
  }
  for (const svc of ungrouped) mg.setNode(`n:${svc.name}`, { width: NODE_WIDTH, height: NODE_HEIGHT });
  const seenMeta = new Set<string>();
  for (const c of connections) {
    const a = metaKey(c.from), b = metaKey(c.to);
    if (a === b) continue;
    const key = `${a}\u0000${b}`;
    if (seenMeta.has(key)) continue;
    seenMeta.add(key);
    if (mg.hasNode(a) && mg.hasNode(b)) mg.setEdge(a, b, {});
  }
  dagre.layout(mg);

  // Resolve final node positions + group boxes.
  const serviceCategories = new Map<string, string>();
  for (const svc of services) serviceCategories.set(svc.name, resolveCategory(svc.type));
  const nodePos = new Map<string, { x: number; y: number }>();
  const positionedGroups: PositionedGroup[] = [];

  validGroups.forEach((grp, idx) => {
    const meta = mg.node(`g:${grp.id}`);
    const s = sub.get(grp.id)!;
    const effW = groupW.get(grp.id)!;
    const boxLeft = meta.x - meta.width / 2;
    const boxTop = meta.y - meta.height / 2;
    const areaLeft = boxLeft + GROUP_INNER_PAD;
    const areaTop = boxTop + GROUP_INNER_PAD + GROUP_HEADER_H;
    for (const [name, p] of s.pos) nodePos.set(name, { x: areaLeft + p.x, y: areaTop + p.y });
    const color = groupColorFor(grp.label, idx);
    positionedGroups.push({
      id: grp.id, label: grp.label,
      x: areaLeft, y: areaTop, width: effW, height: s.height,
      color: color.border,
    });
  });
  for (const svc of ungrouped) {
    const meta = mg.node(`n:${svc.name}`);
    nodePos.set(svc.name, { x: meta.x - NODE_WIDTH / 2, y: meta.y - NODE_HEIGHT / 2 });
  }

  const positionedNodes: PositionedNode[] = services.map(svc => {
    const p = nodePos.get(svc.name) ?? { x: 0, y: 0 };
    const category = serviceCategories.get(svc.name) ?? 'other';
    const colors = getCategoryColor(category);
    return {
      name: svc.name, type: svc.type, description: svc.description ?? '',
      category, groupId: svc.groupId ?? null,
      x: p.x, y: p.y, width: NODE_WIDTH, height: NODE_HEIGHT,
      color: colors.border, textColor: colors.text,
    };
  });
  const rectOf = new Map(positionedNodes.map(n => [n.name, { x: n.x, y: n.y, width: n.width, height: n.height }]));

  // Edges: border-anchor endpoints; the renderer's orthogonal router draws them.
  const serviceNames = new Set(services.map(s => s.name));
  const positionedEdges: PositionedEdge[] = connections
    .filter(c => serviceNames.has(c.from) && serviceNames.has(c.to) && c.from !== c.to)
    .map(c => {
      const ar = rectOf.get(c.from)!, br = rectOf.get(c.to)!;
      const { s, t } = borderAnchor(ar, br, direction);
      return { from: c.from, to: c.to, label: c.label ?? '', type: c.type ?? 'sync', points: [s, t] };
    });

  // Canvas bounds.
  let maxX = 0, maxY = 0;
  for (const n of positionedNodes) { maxX = Math.max(maxX, n.x + n.width); maxY = Math.max(maxY, n.y + n.height); }
  for (const gr of positionedGroups) { maxX = Math.max(maxX, gr.x + gr.width); maxY = Math.max(maxY, gr.y + gr.height); }
  const width = maxX + PADDING;
  const height = maxY + PADDING;

  return { nodes: positionedNodes, edges: positionedEdges, groups: positionedGroups, width, height, direction };
}

/**
 * Compute a positioned layout for the diagram. When groups are present, uses a
 * two-level grouped layout (non-overlapping group lanes); otherwise falls back
 * to a single compound dagre layout.
 */
export function computeLayout(
  services: DiagramService[],
  connections: DiagramConnection[],
  groups: DiagramGroup[],
  direction: 'TB' | 'LR' = 'TB',
): LayoutResult {
  if (groups && groups.length > 0) {
    try {
      const grouped = computeGroupedLayout(services, connections, groups, direction);
      if (grouped) return grouped;
    } catch {
      // Fall back to the flat compound layout on any grouping error.
    }
  }
  return computeFlatLayout(services, connections, groups, direction);
}

// ── Category resolver ──────────────────────────────────────────────────

const TYPE_TO_CATEGORY: Record<string, string> = {
  'azure openai': 'ai + machine learning', 'cognitive services': 'ai + machine learning',
  'computer vision': 'ai + machine learning', 'custom vision': 'ai + machine learning',
  'speech services': 'ai + machine learning', 'translator': 'ai + machine learning',
  'language': 'ai + machine learning', 'document intelligence': 'ai + machine learning',
  'azure machine learning': 'ai + machine learning', 'azure cognitive search': 'ai + machine learning',
  'virtual machines': 'compute', 'functions': 'compute',
  'app service': 'app services',
  'container instances': 'containers', 'kubernetes service': 'containers',
  'container registry': 'containers', 'container apps': 'containers',
  'azure cosmos db': 'databases', 'sql database': 'databases',
  'postgresql': 'databases', 'mysql': 'databases', 'redis cache': 'databases',
  'storage account': 'storage', 'data lake storage': 'storage',
  'application gateway': 'networking', 'azure front door': 'networking',
  'cdn': 'networking', 'virtual network': 'networking', 'load balancer': 'networking',
  'azure firewall': 'networking', 'vpn gateway': 'networking', 'expressroute': 'networking',
  'traffic manager': 'networking', 'azure bastion': 'networking',
  'azure ddos protection': 'networking', 'private link': 'networking', 'azure dns': 'networking',
  'network watcher': 'networking', 'web application firewall': 'networking',
  'data factory': 'analytics', 'azure synapse analytics': 'analytics',
  'stream analytics': 'analytics', 'event hubs': 'analytics',
  'power bi embedded': 'analytics', 'azure workbooks': 'analytics',
  'service bus': 'integration', 'logic apps': 'integration',
  'api management': 'integration', 'event grid': 'integration',
  'azure api for fhir': 'integration',
  'signalr service': 'web', 'static web apps': 'web',
  'azure monitor': 'monitor', 'application insights': 'monitor', 'log analytics': 'monitor',
  'azure managed grafana': 'monitor',
  'key vault': 'security', 'microsoft defender for cloud': 'security',
  'microsoft sentinel': 'security',
  'microsoft entra id': 'identity',
  'backup': 'management + governance', 'azure policy': 'management + governance',
  'microsoft purview': 'management + governance',
  'iot hub': 'iot', 'iot central': 'iot', 'digital twins': 'iot', 'notification hubs': 'iot',
};

function resolveCategory(serviceType: string): string {
  // Fast path / explicit overrides for exact lowercased type strings.
  const direct = TYPE_TO_CATEGORY[serviceType.toLowerCase()];
  if (direct) return direct;
  // Alias-aware catalog resolution handles real-world type variants like
  // "Cosmos DB", "Blob Storage", "Azure AI Search", "Azure Cache for Redis".
  const canonical = resolveServiceName(serviceType);
  if (canonical) return SERVICE_CATALOG[canonical].category;
  return 'other';
}
