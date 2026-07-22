// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * SVG Renderer for SpecKit Diagrams
 *
 * Generates professional Azure-branded SVG architecture diagrams from
 * positioned layout data. Produces self-contained SVG markup that can be
 * embedded directly in SpecKit markdown files, replacing Mermaid blocks.
 *
 * Features:
 *   - Azure category-colored service nodes with rounded corners
 *   - Service type badges (abbreviated)
 *   - Labeled connection edges with directional arrows
 *   - Group containers with headers
 *   - Responsive viewBox for any diagram size
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as resolvePath } from 'node:path';

import type { LayoutResult, PositionedNode, PositionedEdge, PositionedGroup } from './layoutEngine.js';

// ── Real Azure icon glyphs ─────────────────────────────────────────────
// iconMap: service name/aliases → { iconFile, category }
// iconSvgs: iconFile → data:image/svg+xml;base64,... (the official glyph)
// Loaded at runtime via fs to avoid ESM JSON-import-attribute friction.
const __iconDir = dirname(fileURLToPath(import.meta.url));

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolvePath(__iconDir, file), 'utf8')) as T;
}

const ICON_MAP = loadJson<Record<string, { displayName?: string; iconFile: string; category: string; aliases?: string[] }>>(
  'iconMap.generated.json',
);
const ICON_SVGS = loadJson<Record<string, string>>('iconSvgs.generated.json');

// Build a case-insensitive lookup from every service name + alias to its icon
// data URI, so any real-world type string resolves to the official glyph.
const ICON_BY_NAME: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(ICON_MAP)) {
    const dataUri = ICON_SVGS[entry.iconFile];
    if (!dataUri) continue;
    const names = [key, entry.displayName, ...(entry.aliases ?? [])].filter(
      (name): name is string => Boolean(name),
    );
    for (const n of names) {
      const normalized = n.toLowerCase();
      const existing = out[normalized];
      if (existing && existing !== dataUri) {
        throw new Error(`Conflicting icon mapping for "${n}"`);
      }
      out[normalized] = dataUri;
    }
  }
  return out;
})();

function resolveIconHref(serviceType: string): string | null {
  return ICON_BY_NAME[serviceType.trim().toLowerCase()] ?? null;
}

// ── Category abbreviations for type badges ─────────────────────────────

const TYPE_ABBREVIATIONS: Record<string, string> = {
  'app service': 'App Svc',
  'azure functions': 'Func',
  'functions': 'Func',
  'virtual machines': 'VM',
  'azure cosmos db': 'Cosmos DB',
  'sql database': 'SQL DB',
  'storage account': 'Storage',
  'azure openai': 'OpenAI',
  'kubernetes service': 'AKS',
  'container apps': 'ACA',
  'container registry': 'ACR',
  'container instances': 'ACI',
  'application gateway': 'App GW',
  'azure front door': 'Front Door',
  'api management': 'APIM',
  'web application firewall': 'WAF',
  'azure kubernetes service': 'AKS',
  'machine learning': 'Azure ML',
  'cognitive search': 'AI Search',
  'key vault': 'Key Vault',
  'microsoft entra id': 'Entra ID',
  'application insights': 'App Insights',
  'azure monitor': 'Monitor',
  'log analytics': 'Log Analytics',
  'service bus': 'Service Bus',
  'event hubs': 'Event Hubs',
  'event grid': 'Event Grid',
  'redis cache': 'Redis',
  'azure cache for redis': 'Redis',
  'logic apps': 'Logic Apps',
  'azure firewall': 'Firewall',
  'load balancer': 'LB',
  'virtual network': 'VNet',
  'azure bastion': 'Bastion',
  'azure machine learning': 'Azure ML',
  'azure cognitive search': 'AI Search',
  'azure ai search': 'AI Search',
  'cosmos db': 'Cosmos DB',
  'blob storage': 'Storage',
  'storage': 'Storage',
  'document intelligence': 'Doc Intel',
  'azure ai document intelligence': 'Doc Intel',
  'azure backup': 'Backup',
  'microsoft defender for cloud': 'Defender',
  'microsoft sentinel': 'Sentinel',
  'data factory': 'ADF',
  'azure synapse analytics': 'Synapse',
  'traffic manager': 'TM',
  'static web apps': 'SWA',
  'signalr service': 'SignalR',
  'backup': 'Backup',
  'azure policy': 'Policy',
  'postgresql': 'PostgreSQL',
  'mysql': 'MySQL',
  'on-premises network': 'On-Prem',
  'on-premises': 'On-Prem',
  'on prem': 'On-Prem',
  'function app': 'Func',
  'monitor': 'Monitor',
  'dashboard': 'Dashboard',
};

function abbreviateType(type: string): string {
  const mapped = TYPE_ABBREVIATIONS[type.toLowerCase()];
  if (mapped) return mapped;
  if (type.length <= 18) return type;
  // Break at a word boundary within the limit rather than mid-word.
  const cut = type.slice(0, 18);
  const sp = cut.lastIndexOf(' ');
  return (sp > 8 ? cut.slice(0, sp) : cut.slice(0, 17).trimEnd()) + '\u2026';
}

// ── Category icon symbols (simple Unicode) ─────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  'ai + machine learning': '🤖',
  'app services': '🌐',
  'compute': '⚡',
  'databases': '🗄️',
  'storage': '💾',
  'networking': '🔗',
  'analytics': '📊',
  'containers': '📦',
  'integration': '🔄',
  'identity': '🔑',
  'management + governance': '⚙️',
  'iot': '📡',
  'monitor': '📈',
  'security': '🛡️',
  'web': '🌍',
  'other': '☁️',
};

// Personas / clients aren't Azure services — give them a recognizable icon
// instead of the generic cloud fallback.
const PERSONA_TYPES = new Set([
  'user', 'users', 'client', 'browser', 'user browser', 'end user', 'customer',
  'actor', 'persona', 'mobile', 'mobile app', 'web browser',
]);

// Clean inline-SVG fallback glyph (colored with the node's accent) for services
// that have no official Azure icon — personas, on-prem systems, and generic
// "other" types. Replaces the emoji fallback so every card has a crisp icon.
function fallbackIcon(node: PositionedNode, x: number, y: number): string {
  const c = node.color;
  const t = node.type.toLowerCase();
  let glyph: string;
  if (PERSONA_TYPES.has(t)) {
    glyph = `<circle cx="9" cy="6" r="3.1" fill="${c}"/><path d="M3.2 15.6 a5.8 5.8 0 0 1 11.6 0 z" fill="${c}"/>`;
  } else if (t.includes('on-prem') || t.includes('on prem') || t.includes('premises')) {
    glyph =
      `<rect x="3" y="3" width="12" height="3.1" rx="1" fill="${c}"/>` +
      `<rect x="3" y="7.45" width="12" height="3.1" rx="1" fill="${c}"/>` +
      `<rect x="3" y="11.9" width="12" height="3.1" rx="1" fill="${c}"/>` +
      `<circle cx="5" cy="4.55" r="0.7" fill="#fff"/>` +
      `<circle cx="5" cy="9" r="0.7" fill="#fff"/>` +
      `<circle cx="5" cy="13.45" r="0.7" fill="#fff"/>`;
  } else {
    glyph = `<path d="M5.4 13.4 a3 3 0 0 1 -0.2 -6 4 4 0 0 1 7.6 -1 2.9 2.9 0 0 1 0.4 5.8 z" fill="${c}"/>`;
  }
  return `<svg x="${x}" y="${y}" width="28" height="28" viewBox="0 0 18 18">${glyph}</svg>`;
}

// Wrap a service name to at most two lines that fit the card width, breaking on
// word boundaries and ellipsizing only as a last resort.
function wrapName(name: string, maxChars: number): string[] {
  if (name.length <= maxChars) return [name];
  const words = name.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (cur && cand.length > maxChars) { lines.push(cur); cur = w; }
    else cur = cand;
  }
  if (cur) lines.push(cur);
  const ellipsize = (l: string) => (l.length > maxChars ? l.slice(0, maxChars - 1).trimEnd() + '\u2026' : l);
  if (lines.length === 1) return [ellipsize(lines[0])];
  if (lines.length === 2) return [lines[0], ellipsize(lines[1])];
  // More than two lines: keep the first, fold the rest into the second.
  return [lines[0], ellipsize(lines.slice(1).join(' '))];
}

// Wrap an edge/connection label to at most two lines so richer, more descriptive
// connection text stays readable instead of stretching into one long chip.
function wrapLabel(text: string, maxChars = 22): string[] {
  const t = (text ?? '').trim();
  if (!t) return [];
  if (t.length <= maxChars) return [t];
  const words = t.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (cur && cand.length > maxChars) { lines.push(cur); cur = w; }
    else cur = cand;
  }
  if (cur) lines.push(cur);
  const ellipsize = (l: string) => (l.length > maxChars ? l.slice(0, maxChars - 1).trimEnd() + '\u2026' : l);
  if (lines.length <= 2) return lines.map((l, i) => (i === 1 ? ellipsize(l) : l));
  // More than two lines: keep the first, fold the rest into the second.
  return [lines[0], ellipsize(lines.slice(1).join(' '))];
}

// ── Edge styling ───────────────────────────────────────────────────────────

const EDGE_STYLES: Record<string, { color: string; dasharray: string }> = {
  sync: { color: '#0078D4', dasharray: '' },
  async: { color: '#8764B8', dasharray: '6,4' },
  optional: { color: '#A0A0A0', dasharray: '4,4' },
};

// ── Theming ────────────────────────────────────────────────────────────

export type ThemeName = 'light' | 'dark';

interface Theme {
  background: string;
  cardFill: string;
  cardShadow: string;
  nameText: string;
  legendText: string;
  watermark: string;
  metaText: string;
  metaPanelFill: string;
  metaPanelStroke: string;
  costText: string;
  costRangeText: string;
  edgeLabelFill: string;
}

const LIGHT_THEME: Theme = {
  background: 'white',
  cardFill: 'white',
  cardShadow: '#00000010',
  nameText: '#1B1B1B',
  legendText: '#666',
  watermark: '#CCC',
  metaText: '#444',
  metaPanelFill: '#FFFFFF',
  metaPanelStroke: '#E1E1E1',
  costText: '#107C10',
  costRangeText: '#8A8886',
  edgeLabelFill: 'white',
};

const DARK_THEME: Theme = {
  background: '#1E1E1E',
  cardFill: '#2D2D30',
  cardShadow: '#00000040',
  nameText: '#F3F3F3',
  legendText: '#A0A0A0',
  watermark: '#555',
  metaText: '#C8C8C8',
  metaPanelFill: '#252526',
  metaPanelStroke: '#3E3E42',
  costText: '#4EC9A6',
  costRangeText: '#9A9A9A',
  edgeLabelFill: '#2D2D30',
};

function resolveTheme(name?: ThemeName): Theme {
  return name === 'dark' ? DARK_THEME : LIGHT_THEME;
}

/** Compact currency formatting for on-canvas cost badges. */
function fmtCost(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  if (n >= 100) return `${Math.round(n)}`;
  return n.toFixed(2).replace(/\.?0+$/, '');
}

// ── SVG generation ─────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderNode(node: PositionedNode, theme: Theme): string {
  const iconHref = resolveIconHref(node.type) ?? resolveIconHref(node.name);
  const typeAbbr = abbreviateType(node.type);
  const rx = 8;

  // Every card now carries a left icon (official glyph, or a crisp inline-SVG
  // fallback), so text always starts at the same offset.
  const textX = node.x + 50;
  const iconSvg = iconHref
    ? `<image x="${node.x + 14}" y="${node.y + 21}" width="28" height="28"
            href="${iconHref}" preserveAspectRatio="xMidYMid meet" />`
    : fallbackIcon(node, node.x + 14, node.y + 21);

  // Name wraps to at most two lines to fit the card width.
  const nameLines = wrapName(node.name, 20);
  const nameSvg = nameLines.length === 1
    ? `<text x="${textX}" y="${node.y + 30}" font-family="Segoe UI, system-ui, sans-serif"
            font-size="13" font-weight="600" fill="${theme.nameText}">${escapeXml(nameLines[0])}</text>`
    : `<text x="${textX}" y="${node.y + 24}" font-family="Segoe UI, system-ui, sans-serif"
            font-size="13" font-weight="600" fill="${theme.nameText}">${escapeXml(nameLines[0])}</text>
       <text x="${textX}" y="${node.y + 40}" font-family="Segoe UI, system-ui, sans-serif"
            font-size="13" font-weight="600" fill="${theme.nameText}">${escapeXml(nameLines[1])}</text>`;
  const badgeY = nameLines.length === 1 ? node.y + 50 : node.y + 56;

  // Optional per-node cost badge (bottom-right). A firm numeric estimate is
  // shown in the accent cost color; when only a curated catalog range exists
  // (usage-based services), the range is shown in a muted color instead.
  const costBadge = node.estimatedCost != null && node.estimatedCost > 0
    ? `<text x="${node.x + node.width - 12}" y="${node.y + node.height - 12}" text-anchor="end"
            font-family="Segoe UI, system-ui, sans-serif" font-size="11" font-weight="600"
            fill="${theme.costText}">~$${fmtCost(node.estimatedCost)}/mo</text>`
    : node.costRange
      ? `<text x="${node.x + node.width - 12}" y="${node.y + node.height - 12}" text-anchor="end"
            font-family="Segoe UI, system-ui, sans-serif" font-size="10" font-style="italic"
            fill="${theme.costRangeText}">${escapeXml(node.costRange)}</text>`
      : '';

  return `
    <!-- ${escapeXml(node.name)} -->
    <g class="node" data-service="${escapeXml(node.name)}" data-type="${escapeXml(node.type)}">
      <!-- Shadow -->
      <rect x="${node.x + 2}" y="${node.y + 2}" width="${node.width}" height="${node.height}"
            rx="${rx}" fill="${theme.cardShadow}" />
      <!-- Card -->
      <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}"
            rx="${rx}" fill="${theme.cardFill}" stroke="${node.color}" stroke-width="2" />
      <!-- Color accent bar -->
      <rect x="${node.x}" y="${node.y}" width="6" height="${node.height}"
            rx="3" fill="${node.color}" />
      ${iconSvg}
      <!-- Name -->
      ${nameSvg}
      <!-- Type badge -->
      <text x="${textX}" y="${badgeY}" font-family="Segoe UI, system-ui, sans-serif"
            font-size="11" fill="${node.color}">
        ${escapeXml(typeAbbr)}
      </text>
      ${costBadge}
    </g>`;
}

interface Pt { x: number; y: number }

// Axis-aligned rectangle + overlap test, used to keep edge-label chips clear of
// node cards and group header bands during placement.
interface LRect { x: number; y: number; w: number; h: number }
function rectsOverlap(a: LRect, b: LRect, pad = 0): boolean {
  return !(
    a.x + a.w + pad < b.x || b.x + b.w + pad < a.x ||
    a.y + a.h + pad < b.y || b.y + b.h + pad < a.y
  );
}

// Build a clean orthogonal (Manhattan) route between an edge's endpoints.
//
// The trunk (the long mid-channel segment) is shifted into a clear gutter so it
// avoids zone containers and non-endpoint node cards instead of cutting straight
// through them. Falls back to the plain midpoint elbow when no clear channel is
// found, so routing never regresses.

// A rectangle to route around, tagged with what it is so an edge can ignore its
// own endpoints' node cards and parent zone boxes.
interface RouteObstacle extends LRect { kind: 'node' | 'group'; id: string; groupId?: string | null }

// Full zone container box as drawn by renderGroup (x-12, y-36, w+24, h+48).
function buildRouteObstacles(layout: LayoutResult): RouteObstacle[] {
  const obs: RouteObstacle[] = [];
  for (const n of layout.nodes) {
    obs.push({ x: n.x, y: n.y, w: n.width, h: n.height, kind: 'node', id: n.name, groupId: n.groupId ?? null });
  }
  for (const g of layout.groups) {
    obs.push({ x: g.x - 12, y: g.y - 36, w: g.width + 24, h: g.height + 48, kind: 'group', id: g.id });
  }
  return obs;
}

// Does the axis-aligned segment a→b cross any non-ignored obstacle?
function segHitsObstacles(a: Pt, b: Pt, obstacles: RouteObstacle[], ignore: (o: RouteObstacle) => boolean, pad = 6): boolean {
  const seg: LRect = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
  return obstacles.some(o => !ignore(o) && rectsOverlap(seg, o, pad));
}

function collapsePoints(raw: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of raw) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.5 || Math.abs(last.y - p.y) > 0.5) out.push(p);
  }
  return out;
}

function routeClear(pts: Pt[], obstacles: RouteObstacle[], ignore: (o: RouteObstacle) => boolean): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    if (segHitsObstacles(pts[i], pts[i + 1], obstacles, ignore)) return false;
  }
  return true;
}

function orthogonalRoute(edge: PositionedEdge, direction: 'TB' | 'LR', obstacles: RouteObstacle[] = [], canvas: { w: number; h: number } = { w: Infinity, h: Infinity }): Pt[] {
  const s = edge.points[0];
  const t = edge.points[edge.points.length - 1];

  // Ignore the edge's own endpoint cards and their parent zone boxes — an edge
  // legitimately exits/enters those.
  const fromNode = obstacles.find(o => o.kind === 'node' && o.id === edge.from);
  const toNode = obstacles.find(o => o.kind === 'node' && o.id === edge.to);
  const fromG = fromNode?.groupId ?? null;
  const toG = toNode?.groupId ?? null;
  const ignore = (o: RouteObstacle): boolean =>
    (o.kind === 'node' && (o.id === edge.from || o.id === edge.to)) ||
    (o.kind === 'group' && ((fromG != null && o.id === fromG) || (toG != null && o.id === toG)));

  const midpointRoute = (): Pt[] => {
    const raw: Pt[] = direction === 'LR'
      ? [s, { x: (s.x + t.x) / 2, y: s.y }, { x: (s.x + t.x) / 2, y: t.y }, t]
      : [s, { x: s.x, y: (s.y + t.y) / 2 }, { x: t.x, y: (s.y + t.y) / 2 }, t];
    const c = collapsePoints(raw);
    return c.length >= 2 ? c : [s, t];
  };

  // No obstacle data → preserve the original midpoint behavior.
  if (obstacles.length === 0) return midpointRoute();

  const active = obstacles.filter(o => !ignore(o));

  // Strategy A — 3-segment trunk: shift the mid-channel trunk into a clear gutter.
  const mid = direction === 'LR' ? (s.x + t.x) / 2 : (s.y + t.y) / 2;
  const lo = direction === 'LR' ? Math.min(s.x, t.x) : Math.min(s.y, t.y);
  const hi = direction === 'LR' ? Math.max(s.x, t.x) : Math.max(s.y, t.y);
  const span = Math.max(hi - lo, 0);
  const reach = span / 2 + 160; // allow routing a bit past the endpoints into a gutter
  const step = 16;
  const trunkOffsets: number[] = [0];
  for (let d = step; d <= reach; d += step) { trunkOffsets.push(d); trunkOffsets.push(-d); }

  for (const off of trunkOffsets) {
    const trunk = mid + off;
    const raw: Pt[] = direction === 'LR'
      ? [s, { x: trunk, y: s.y }, { x: trunk, y: t.y }, t]
      : [s, { x: s.x, y: trunk }, { x: t.x, y: trunk }, t];
    const pts = collapsePoints(raw);
    if (pts.length >= 2 && routeClear(pts, active, () => false)) return pts;
  }

  // Strategy B — side detour: exit the source, travel along a side lane parallel
  // to the flow, then enter the target. Handles a zone sitting directly between
  // vertically/horizontally separated endpoints (which no trunk shift can clear).
  // Lanes are kept a label's width inside the canvas so detoured edges + their
  // label chips never spill off the edge of the diagram.
  if (active.length > 0) {
    const e = 24;
    const LANE_MARGIN = 80;
    if (direction === 'TB') {
      const clampLo = LANE_MARGIN, clampHi = canvas.w - LANE_MARGIN;
      const secMin = Math.min(...active.map(o => o.x)) - 40;
      const secMax = Math.max(...active.map(o => o.x + o.w)) + 40;
      const sy = s.y + (t.y >= s.y ? e : -e);
      const ty = t.y + (t.y >= s.y ? -e : e);
      const lanes = laneCandidates(s.x, t.x, secMin, secMax).filter(v => v >= clampLo && v <= clampHi);
      for (const laneX of lanes) {
        const pts = collapsePoints([s, { x: s.x, y: sy }, { x: laneX, y: sy }, { x: laneX, y: ty }, { x: t.x, y: ty }, t]);
        if (pts.length >= 2 && routeClear(pts, active, () => false)) return pts;
      }
    } else {
      const clampLo = LANE_MARGIN, clampHi = canvas.h - LANE_MARGIN;
      const secMin = Math.min(...active.map(o => o.y)) - 40;
      const secMax = Math.max(...active.map(o => o.y + o.h)) + 40;
      const sx = s.x + (t.x >= s.x ? e : -e);
      const tx = t.x + (t.x >= s.x ? -e : e);
      const lanes = laneCandidates(s.y, t.y, secMin, secMax).filter(v => v >= clampLo && v <= clampHi);
      for (const laneY of lanes) {
        const pts = collapsePoints([s, { x: sx, y: s.y }, { x: sx, y: laneY }, { x: tx, y: laneY }, { x: tx, y: t.y }, t]);
        if (pts.length >= 2 && routeClear(pts, active, () => false)) return pts;
      }
    }
  }

  // Nothing clear — fall back to the midpoint elbow (no regression).
  return midpointRoute();
}

// Candidate side-lane positions for a detour, ordered so the shortest detour
// (closest to an endpoint) is tried first, then outward toward the side gutters.
function laneCandidates(a: number, b: number, secMin: number, secMax: number): number[] {
  const set = new Set<number>([a, b, secMin, secMax]);
  for (let v = secMin; v <= secMax; v += 40) set.add(v);
  const pref = (v: number) => Math.min(Math.abs(v - a), Math.abs(v - b));
  return [...set].sort((p, q) => pref(p) - pref(q));
}

// Emit an SVG path for an orthogonal point list with rounded corners.
function roundedOrthoPathD(pts: Pt[], radius = 10): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1], p = pts[i], next = pts[i + 1];
    const d1 = Math.hypot(p.x - prev.x, p.y - prev.y) || 1;
    const d2 = Math.hypot(next.x - p.x, next.y - p.y) || 1;
    const r = Math.min(radius, d1 / 2, d2 / 2);
    const c1x = p.x + ((prev.x - p.x) / d1) * r, c1y = p.y + ((prev.y - p.y) / d1) * r;
    const c2x = p.x + ((next.x - p.x) / d2) * r, c2y = p.y + ((next.y - p.y) / d2) * r;
    d += ` L ${c1x} ${c1y} Q ${p.x} ${p.y} ${c2x} ${c2y}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

// Label anchor = middle of the trunk (the long mid-channel segment).
function edgeLabelAnchor(route: Pt[]): Pt {
  if (route.length >= 4) {
    const a = route[1], b = route[2];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  const a = route[0], b = route[route.length - 1];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Render only the edge path + arrowhead. Labels are rendered separately (and
// last) so that no later edge line paints over an earlier edge's label chip.
function renderEdgePath(edge: PositionedEdge, direction: 'TB' | 'LR', obstacles: RouteObstacle[] = [], canvas: { w: number; h: number } = { w: Infinity, h: Infinity }): string {
  if (edge.points.length < 2) return '';

  const style = EDGE_STYLES[edge.type] ?? EDGE_STYLES.sync;
  const route = orthogonalRoute(edge, direction, obstacles, canvas);
  const pathData = roundedOrthoPathD(route);

  // Arrowhead from the last orthogonal segment (always axis-aligned now).
  const last = route[route.length - 1];
  const prev = route[route.length - 2];
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  const arrowLen = 10;
  const arrowPoints = [
    `${last.x},${last.y}`,
    `${last.x - arrowLen * Math.cos(angle - 0.4)},${last.y - arrowLen * Math.sin(angle - 0.4)}`,
    `${last.x - arrowLen * Math.cos(angle + 0.4)},${last.y - arrowLen * Math.sin(angle + 0.4)}`,
  ].join(' ');

  return `
    <g class="edge" data-from="${escapeXml(edge.from)}" data-to="${escapeXml(edge.to)}">
      <path d="${pathData}" fill="none" stroke="${style.color}" stroke-width="1.5"
            ${style.dasharray ? `stroke-dasharray="${style.dasharray}"` : ''} />
      <polygon points="${arrowPoints}" fill="${style.color}" />
    </g>`;
}

// Geometry for an edge's label chip (wrapped lines + box size + trunk anchor),
// computed independently of final placement so the layout pass can
// collision-test candidate positions before committing.
interface EdgeLabelBox {
  edge: PositionedEdge;
  lines: string[];
  boxW: number;
  boxH: number;
  anchor: Pt;
}

function edgeLabelBox(edge: PositionedEdge, direction: 'TB' | 'LR', obstacles: RouteObstacle[] = [], canvas: { w: number; h: number } = { w: Infinity, h: Infinity }): EdgeLabelBox | null {
  if (edge.points.length < 2 || !edge.label) return null;
  const route = orthogonalRoute(edge, direction, obstacles, canvas);
  const lines = wrapLabel(edge.label);
  if (lines.length === 0) return null;
  const maxLen = Math.max(...lines.map(l => l.length));
  const boxW = maxLen * 6.2 + 14;      // padX * 2 = 14
  const boxH = lines.length * 12 + 8;  // lineH * n + padY * 2
  return { edge, lines, boxW, boxH, anchor: edgeLabelAnchor(route) };
}

// Render an edge label as an opaque, up-to-two-line chip centered at (cx, cy).
// Drawn after all paths and nodes so the text is never overpainted.
function renderEdgeLabelChip(box: EdgeLabelBox, cx: number, cy: number, theme: Theme = LIGHT_THEME): string {
  const style = EDGE_STYLES[box.edge.type] ?? EDGE_STYLES.sync;
  const boxX = cx - box.boxW / 2;
  const boxY = cy - box.boxH / 2;
  const firstBaseline = boxY + 4 + 9;  // padY + baseline
  const tspans = box.lines
    .map((l, i) => `<tspan x="${cx}" y="${firstBaseline + i * 12}">${escapeXml(l)}</tspan>`)
    .join('');

  return `
    <g class="edge-label">
      <rect x="${boxX}" y="${boxY}" width="${box.boxW}" height="${box.boxH}" rx="4"
            fill="${theme.edgeLabelFill}" stroke="${style.color}" stroke-width="0.75" />
      <text text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif"
            font-size="10" fill="${style.color}">${tspans}</text>
    </g>`;
}


// Assign edge-label positions with collision avoidance: chips are nudged
// along/around their trunk anchor so they don't overlap node cards, group
// header bands, or previously-placed labels. Returns joined SVG markup.
function placeEdgeLabels(layout: LayoutResult, direction: 'TB' | 'LR', theme: Theme, routeObstacles: RouteObstacle[], canvas: { w: number; h: number }): string {
  const obstacles: LRect[] = [
    ...layout.nodes.map(n => ({ x: n.x, y: n.y, w: n.width, h: n.height })),
    // Group header band (see renderGroup: y = group.y - 12 - 24, height 24).
    ...layout.groups.map(g => ({ x: g.x - 12, y: g.y - 36, w: g.width + 24, h: 24 })),
  ];
  const dxs = [0, -46, 46, -92, 92, -140, 140];
  const dys = [0, -20, 20, -40, 40, -62, 62, -84, 84];
  const candidates = dys
    .flatMap(dy => dxs.map(dx => ({ dx, dy })))
    .sort((a, b) => (Math.abs(a.dx) + Math.abs(a.dy)) - (Math.abs(b.dx) + Math.abs(b.dy)));

  const placed: LRect[] = [];
  return layout.edges
    .map(edge => {
      const box = edgeLabelBox(edge, direction, routeObstacles, canvas);
      if (!box) return '';
      let chosen = candidates[0];
      for (const off of candidates) {
        const cx = box.anchor.x + off.dx, cy = box.anchor.y + off.dy;
        const r: LRect = { x: cx - box.boxW / 2, y: cy - box.boxH / 2, w: box.boxW, h: box.boxH };
        const hit =
          obstacles.some(o => rectsOverlap(r, o, 2)) ||
          placed.some(o => rectsOverlap(r, o, 4));
        if (!hit) { chosen = off; break; }
      }
      const cx = box.anchor.x + chosen.dx, cy = box.anchor.y + chosen.dy;
      placed.push({ x: cx - box.boxW / 2, y: cy - box.boxH / 2, w: box.boxW, h: box.boxH });
      return renderEdgeLabelChip(box, cx, cy, theme);
    })
    .join('\n');
}

function renderGroup(group: PositionedGroup): string {
  const pad = 12;
  const headerH = 24;
  const x = group.x - pad;
  const y = group.y - pad - headerH;
  const w = group.width + pad * 2;
  const h = group.height + pad * 2 + headerH;
  return `
    <g class="group" data-group="${escapeXml(group.id)}">
      <!-- Container -->
      <rect x="${x}" y="${y}" width="${w}" height="${h}"
            rx="12" fill="${group.color}0D" stroke="${group.color}"
            stroke-width="1.5" stroke-dasharray="6,3" />
      <!-- Header bar -->
      <path d="M ${x} ${y + 12} q 0 -12 12 -12 h ${w - 24} q 12 0 12 12 v ${headerH - 12} h ${-w} z"
            fill="${group.color}" opacity="0.92" />
      <text x="${x + 12}" y="${y + 16}" text-anchor="start"
            font-family="Segoe UI, system-ui, sans-serif" font-size="12" font-weight="600"
            fill="#FFFFFF">${escapeXml(group.label)}</text>
    </g>`;
}

// ── Public API ─────────────────────────────────────────────────────────

export interface RenderSvgOptions {
  /** Visual theme. Default: 'light'. */
  theme?: ThemeName;
  /** Author shown in the metadata panel (top-right). */
  author?: string;
  /** Provenance label, e.g. the model that generated the design. */
  generatedBy?: string;
  /** ISO date or display date for the metadata panel. Default: today. */
  date?: string;
  /** Currency code for the total-cost footer. Default: 'USD'. */
  currency?: string;
}

export function renderSvg(layout: LayoutResult, title?: string, options: RenderSvgOptions = {}): string {
  const theme = resolveTheme(options.theme);
  const edgeDir: 'TB' | 'LR' = layout.direction ?? 'TB';
  // Zone + node rectangles the edge router steers trunks around.
  const routeObstacles = buildRouteObstacles(layout);
  const routeCanvas = { w: layout.width, h: layout.height };

  // Center the title, but keep it clear of the top-right metadata panel on
  // narrow canvases (approx panel width 210 + margins). Nudge the anchor left
  // just enough that the title's right edge stops before the panel.
  const metaReserveW = 222;
  let titleX = layout.width / 2;
  if (title) {
    const halfW = title.length * 5.2; // ~half text width at 16px bold
    const panelLeft = layout.width - metaReserveW;
    if (titleX + halfW > panelLeft) titleX = Math.max(halfW + 12, panelLeft - halfW);
  }

  const titleBar = title
    ? `<text x="${titleX}" y="24" text-anchor="middle"
            font-family="Segoe UI, system-ui, sans-serif" font-size="16" font-weight="700"
            fill="${theme.nameText}">${escapeXml(title)}</text>`
    : '';

  const titleOffset = title ? 40 : 0;
  const totalHeight = layout.height + titleOffset;

  // ── Footer band (below the diagram): wrapped legend, then cost total ──
  // A dedicated band under the canvas keeps the legend and cost total from
  // overlapping each other, the last group's border, or the watermark.
  const categories = [...new Set(layout.nodes.map(n => n.category))].sort();
  const legendItemW = 168;
  const legendCols = Math.max(1, Math.floor((layout.width - 40) / legendItemW));
  const legendRows = Math.max(1, Math.ceil(categories.length / legendCols));
  const legendRowH = 18;
  const footerTop = totalHeight + 22;
  const legend = categories
    .map((cat, i) => {
      const icon = CATEGORY_ICONS[cat] ?? '☁️';
      const col = i % legendCols;
      const row = Math.floor(i / legendCols);
      const x = 20 + col * legendItemW;
      const y = footerTop + row * legendRowH;
      return `<text x="${x}" y="${y}" font-family="Segoe UI, system-ui, sans-serif"
                    font-size="10" fill="${theme.legendText}">${icon} ${escapeXml(cat)}</text>`;
    })
    .join('\n');
  const costY = footerTop + legendRows * legendRowH + 6;

  // Total estimated monthly cost across nodes that carry a firm estimate.
  const costedNodes = layout.nodes.filter(n => n.estimatedCost != null && n.estimatedCost > 0);
  const rangeNodes = layout.nodes.filter(
    n => (n.estimatedCost == null || n.estimatedCost <= 0) && n.costRange,
  );
  const totalCost = costedNodes.reduce((sum, n) => sum + (n.estimatedCost ?? 0), 0);
  const currency = options.currency ?? costedNodes[0]?.costCurrency ?? 'USD';
  const rangeNote = rangeNodes.length > 0
    ? `; ${rangeNodes.length} usage-based shown as ranges`
    : '';
  const footerText = costedNodes.length > 0
    ? `Est. total ~$${fmtCost(totalCost)}/mo (${escapeXml(currency)}, ${costedNodes.length} of ${layout.nodes.length} priced${rangeNote})`
    : `Usage-based pricing — ${rangeNodes.length} of ${layout.nodes.length} services shown as catalog ranges`;
  const totalCostFooter = costedNodes.length > 0 || rangeNodes.length > 0
    ? `<text x="20" y="${costY}" text-anchor="start"
            font-family="Segoe UI, system-ui, sans-serif" font-size="11" font-weight="600"
            fill="${theme.costText}">${footerText}</text>`
    : '';

  // Optional metadata panel (top-right): author / date / provenance.
  const metaLines: string[] = [];
  if (options.author) metaLines.push(`Author: ${options.author}`);
  metaLines.push(`Date: ${options.date ?? new Date().toISOString().slice(0, 10)}`);
  if (options.generatedBy) metaLines.push(`Generated by: ${options.generatedBy}`);
  const panelW = 210;
  const panelH = 16 + metaLines.length * 16;
  const panelX = layout.width - panelW - 12;
  const panelY = 12;
  const metaPanel = `
    <g class="metadata">
      <rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" rx="8"
            fill="${theme.metaPanelFill}" stroke="${theme.metaPanelStroke}" stroke-width="1" />
      ${metaLines
        .map((line, i) => `<text x="${panelX + 12}" y="${panelY + 20 + i * 16}"
              font-family="Segoe UI, system-ui, sans-serif" font-size="10"
              fill="${theme.metaText}">${escapeXml(line)}</text>`)
        .join('\n')}
    </g>`;

  // Total canvas height = diagram + footer band (legend rows + cost row) + pad.
  const totalWithLegend = costY + 22;

  // Collision-aware edge labels (kept off nodes + group headers).
  const edgeLabelsMarkup = placeEdgeLabels(layout, edgeDir, theme, routeObstacles, routeCanvas);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="0 0 ${layout.width} ${totalWithLegend}"
     width="${layout.width}" height="${totalWithLegend}"
     style="background: ${theme.background}; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;">

  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="1" dy="1" stdDeviation="2" flood-opacity="0.1"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect x="0" y="0" width="${layout.width}" height="${totalWithLegend}" fill="${theme.background}" />

  ${titleBar}
  ${metaPanel}

  <g transform="translate(0, ${titleOffset})">
    <!-- Groups (background) -->
    ${layout.groups.map(renderGroup).join('\n')}

    <!-- Edge paths (drawn first so nothing paints over labels) -->
    ${layout.edges.map(e => renderEdgePath(e, edgeDir, routeObstacles, routeCanvas)).join('\n')}

    <!-- Nodes (foreground) -->
    ${layout.nodes.map(n => renderNode(n, theme)).join('\n')}

    <!-- Edge labels (top-most for legibility; collision-avoided) -->
    ${edgeLabelsMarkup}
  </g>

  <!-- Legend -->
  ${legend}

  <!-- Total cost -->
  ${totalCostFooter}

  <!-- Watermark -->
  <text x="${layout.width - 10}" y="${totalWithLegend - 8}" text-anchor="end"
        font-family="Segoe UI, system-ui, sans-serif" font-size="9" fill="${theme.watermark}">
    Generated by Azure Architecture Diagram Builder
  </text>
</svg>`;
}
