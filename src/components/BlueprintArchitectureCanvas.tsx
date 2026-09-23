// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * BlueprintArchitectureCanvas
 * ---------------------------
 * SVG-based whiteboard / sketchnote-style renderer for a
 * `BlueprintArchitecture`. Phase 1: takes coordinates as authored by the AI
 * and lays out zones, nodes, and labeled edges with numbered step badges.
 *
 * Like the swim-lane canvas, this is intended for off-screen mounting +
 * PNG export, and is additive (does not affect the main ReactFlow canvas).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  BlueprintArchitecture,
  BpNode,
  BpZone,
} from '../services/blueprintArchitectureAI';
import { getServiceIconMapping } from '../data/serviceIconMapping';
import { resolveServiceIconLoose } from '../utils/serviceIconFuzzy';
import { loadIcon } from '../utils/iconLoader';
import './BlueprintArchitectureCanvas.css';

export interface BlueprintArchitectureCanvasProps {
  data: BlueprintArchitecture;
  /** Optional author/credit chip in the header. */
  author?: string;
  /**
   * Pre-resolved icon data: URLs keyed by service name. Used by the off-screen
   * PNG exporter to guarantee icons are present at capture time.
   */
  iconMap?: Record<string, string>;
  /** Pre-resolved persona/users icon data: URL. */
  personaIconUrl?: string;
  /**
   * Position of the numbered workflow legend relative to the diagram.
   * - 'bottom' (default): legend below the SVG in two columns (wide canvases).
   * - 'right': legend to the right of the SVG in a single column (tall canvases).
   * - 'auto': pick based on diagram aspect ratio (cW/cH).
   */
  legendPosition?: 'bottom' | 'right' | 'auto';
}

const LEGEND_RIGHT_WIDTH = 400;

function resolveLegendPosition(
  position: 'bottom' | 'right' | 'auto' | undefined,
  canvasWidth: number,
  canvasHeight: number,
): 'bottom' | 'right' {
  if (position === 'bottom' || position === 'right') return position;
  const aspect = canvasWidth / Math.max(canvasHeight, 1);
  return aspect > 1.4 ? 'bottom' : 'right';
}

const NODE_W = 180;
const NODE_H = 120;
const ICON = 44;
const BADGE_R = 19;           // outer radius of a numbered step badge (white halo)
const ARROW_GAP = 6;          // pixels between path end and node edge so the arrowhead is never clipped
const LABEL_LINE_H = 12;      // line height for wrapped service labels
const LABEL_MAX_CHARS = 20;   // soft wrap target per line
const TILE_PAD = 8;           // clearance kept around node tiles when routing edges

/** Axis-aligned segment ↔ axis-aligned rect intersection test. */
function segmentIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  rx1: number, ry1: number, rx2: number, ry2: number,
): boolean {
  if (x1 === x2) {
    if (x1 <= rx1 || x1 >= rx2) return false;
    const sy1 = Math.min(y1, y2);
    const sy2 = Math.max(y1, y2);
    return sy1 < ry2 && sy2 > ry1;
  }
  if (y1 === y2) {
    if (y1 <= ry1 || y1 >= ry2) return false;
    const sx1 = Math.min(x1, x2);
    const sx2 = Math.max(x1, x2);
    return sx1 < rx2 && sx2 > rx1;
  }
  return false;
}

/**
 * Search for a midpoint coordinate (mx for horizontal routing, my for vertical)
 * such that the resulting 3-segment orthogonal path does not cross any blocker
 * tile. Falls back to the naive midpoint if no clear value is found.
 */
function findClearOrthogonalMidpoint(
  ax: number, ay: number, bx: number, by: number,
  horizontal: boolean,
  blockers: BpNode[],
): number {
  const tileH = NODE_H - 22;
  const naive = horizontal ? (ax + bx) / 2 : (ay + by) / 2;

  const clear = (m: number): boolean => {
    let segs: Array<[number, number, number, number]>;
    if (horizontal) {
      segs = [[ax, ay, m, ay], [m, ay, m, by], [m, by, bx, by]];
    } else {
      segs = [[ax, ay, ax, m], [ax, m, bx, m], [bx, m, bx, by]];
    }
    for (const n of blockers) {
      const rx1 = n.x - TILE_PAD;
      const rx2 = n.x + NODE_W + TILE_PAD;
      const ry1 = n.y - TILE_PAD;
      const ry2 = n.y + tileH + TILE_PAD;
      for (const [sx1, sy1, sx2, sy2] of segs) {
        if (segmentIntersectsRect(sx1, sy1, sx2, sy2, rx1, ry1, rx2, ry2)) return false;
      }
    }
    return true;
  };

  if (clear(naive)) return naive;

  // Search outward from the naive midpoint. Allow stepping a bit past the
  // endpoint span to handle blockers sitting near a node edge.
  const lo = horizontal ? Math.min(ax, bx) : Math.min(ay, by);
  const hi = horizontal ? Math.max(ax, bx) : Math.max(ay, by);
  const reach = Math.max(120, (hi - lo) / 2 + 80);
  for (let off = 8; off <= reach; off += 8) {
    const plus = naive + off;
    const minus = naive - off;
    if (plus <= hi + 60 && clear(plus)) return plus;
    if (minus >= lo - 60 && clear(minus)) return minus;
  }
  return naive;
}

/** Geometry produced for each edge so paths and decorations can be rendered
 *  in independent passes (paths beneath badges/labels). */
interface EdgeGeom {
  ax: number; ay: number;
  bx: number; by: number;
  endX: number; endY: number;
  horizontal: boolean;
  d: string;
  segs: Array<{ x1: number; y1: number; x2: number; y2: number; len: number; horiz: boolean }>;
  longest: { x1: number; y1: number; x2: number; y2: number; len: number; horiz: boolean };
  strokeDash?: string;
}

/**
 * Compute the rendered path and segment breakdown for an edge, including
 * obstacle-aware midpoint selection for orthogonal routing.
 */
function computeEdgeGeometry(
  a: BpNode,
  b: BpNode,
  edge: { routing?: string; style?: string },
  allNodes: BpNode[],
): EdgeGeom {
  const tileH = NODE_H - 22;
  const aCx = a.x + NODE_W / 2;
  const aCy = a.y + tileH / 2;
  const bCx = b.x + NODE_W / 2;
  const bCy = b.y + tileH / 2;
  const horizontal = Math.abs(bCx - aCx) >= Math.abs(bCy - aCy);

  let ax: number, ay: number, bx: number, by: number;
  if (horizontal) {
    if (bCx >= aCx) { ax = a.x + NODE_W; ay = aCy; bx = b.x;          by = bCy; }
    else            { ax = a.x;          ay = aCy; bx = b.x + NODE_W; by = bCy; }
  } else {
    if (bCy >= aCy) { ax = aCx; ay = a.y + tileH; bx = bCx; by = b.y; }
    else            { ax = aCx; ay = a.y;        bx = bCx; by = b.y + tileH; }
  }

  const routing = edge.routing || 'orthogonal';
  const blockers = allNodes.filter((n) => n.id !== a.id && n.id !== b.id);

  let d: string;
  let endX = bx;
  let endY = by;
  type Seg = { x1: number; y1: number; x2: number; y2: number; len: number; horiz: boolean };
  let segs: Seg[];

  if (routing === 'orthogonal') {
    if (horizontal) {
      const mx = findClearOrthogonalMidpoint(ax, ay, bx, by, true, blockers);
      endX = bx - Math.sign(bx - mx || 1) * ARROW_GAP;
      endY = by;
      d = `M ${ax} ${ay} L ${mx} ${ay} L ${mx} ${endY} L ${endX} ${endY}`;
      segs = [
        { x1: ax, y1: ay, x2: mx, y2: ay, len: Math.abs(mx - ax), horiz: true },
        { x1: mx, y1: ay, x2: mx, y2: by, len: Math.abs(by - ay), horiz: false },
        { x1: mx, y1: by, x2: bx, y2: by, len: Math.abs(bx - mx), horiz: true },
      ];
    } else {
      const my = findClearOrthogonalMidpoint(ax, ay, bx, by, false, blockers);
      endX = bx;
      endY = by - Math.sign(by - my || 1) * ARROW_GAP;
      d = `M ${ax} ${ay} L ${ax} ${my} L ${endX} ${my} L ${endX} ${endY}`;
      segs = [
        { x1: ax, y1: ay, x2: ax, y2: my, len: Math.abs(my - ay), horiz: false },
        { x1: ax, y1: my, x2: bx, y2: my, len: Math.abs(bx - ax), horiz: true },
        { x1: bx, y1: my, x2: bx, y2: by, len: Math.abs(by - my), horiz: false },
      ];
    }
  } else if (routing === 'curve') {
    const dx = bx - ax;
    const dy = by - ay;
    const totalLen = Math.hypot(dx, dy) || 1;
    const ux = dx / totalLen;
    const uy = dy / totalLen;
    endX = bx - ux * ARROW_GAP;
    endY = by - uy * ARROW_GAP;
    const offset = Math.max(40, Math.min(120, Math.abs(horizontal ? dx : dy) / 2));
    if (horizontal) {
      d = `M ${ax} ${ay} C ${ax + offset} ${ay}, ${endX - offset} ${endY}, ${endX} ${endY}`;
    } else {
      d = `M ${ax} ${ay} C ${ax} ${ay + offset}, ${endX} ${endY - offset}, ${endX} ${endY}`;
    }
    segs = [{ x1: ax, y1: ay, x2: endX, y2: endY, len: totalLen, horiz: horizontal }];
  } else {
    const dx = bx - ax;
    const dy = by - ay;
    const totalLen = Math.hypot(dx, dy) || 1;
    const ux = dx / totalLen;
    const uy = dy / totalLen;
    endX = bx - ux * ARROW_GAP;
    endY = by - uy * ARROW_GAP;
    d = `M ${ax} ${ay} L ${endX} ${endY}`;
    segs = [{ x1: ax, y1: ay, x2: endX, y2: endY, len: totalLen, horiz: horizontal }];
  }

  const longest = segs.reduce((p, c) => (c.len > p.len ? c : p));
  const strokeDash =
    edge.style === 'dashed' ? '6 5' : edge.style === 'dotted' ? '2 4' : undefined;

  return { ax, ay, bx, by, endX, endY, horizontal, d, segs, longest, strokeDash };
}

// Approved short aliases for noisy or commonly-truncated service names.
// Applied only inside blueprint rendering so it does not affect topology /
// validation paths or the underlying architecture data.
const SERVICE_ALIASES: Record<string, string> = {
  'Azure Database for PostgreSQL': 'Azure DB for PostgreSQL',
  'Azure Database for MySQL': 'Azure DB for MySQL',
  'Azure Database for MariaDB': 'Azure DB for MariaDB',
  'Azure Content Delivery Network': 'Azure CDN',
  'Azure Front Door': 'Azure Front Door',
  'Azure Application Gateway': 'Application Gateway',
  'Azure Static Web Apps': 'Static Web Apps',
  'Azure App Service': 'App Service',
  'Azure Functions': 'Azure Functions',
  'Azure Container Apps': 'Container Apps',
  'Azure Kubernetes Service': 'AKS',
  'Azure Container Instances': 'Container Instances',
  'Azure Data Lake Storage': 'Data Lake Storage',
  'Azure Synapse Analytics': 'Synapse Analytics',
  'Azure Data Factory': 'Data Factory',
  'Azure Databricks': 'Databricks',
  'Azure Blob Storage': 'Blob Storage',
  'Azure Application Insights': 'Application Insights',
  'Azure Monitor': 'Azure Monitor',
  'Azure Log Analytics': 'Log Analytics',
  'Azure Key Vault': 'Key Vault',
  'Azure Cosmos DB': 'Cosmos DB',
  'Azure SQL Database': 'Azure SQL DB',
  'Azure SQL Managed Instance': 'SQL Managed Instance',
  'Azure Service Bus': 'Service Bus',
  'Azure Event Hubs': 'Event Hubs',
  'Azure Event Grid': 'Event Grid',
  'Azure Logic Apps': 'Logic Apps',
  'Azure API Management': 'API Management',
  'Azure Power BI Embedded': 'Power BI Embedded',
  'Microsoft Power BI Embedded': 'Power BI Embedded',
  'Azure Active Directory': 'Microsoft Entra ID',
  'Azure AD B2C': 'Microsoft Entra External ID',
  'Microsoft Entra ID': 'Microsoft Entra ID',
};

function displayLabel(name: string): string {
  return SERVICE_ALIASES[name] ?? name;
}

/**
 * Word-wrap a service label to at most 2 lines of ~LABEL_MAX_CHARS each.
 * Falls back to ellipsis only if the label simply will not fit; never clips
 * a single short word.
 */
function wrapLabel(name: string, maxChars = LABEL_MAX_CHARS): string[] {
  const label = displayLabel(name);
  if (label.length <= maxChars) return [label];

  const words = label.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  if (lines.length <= 2) return lines;

  // More than 2 lines: keep first line, fold the rest into line 2 with ellipsis if needed.
  const tail = lines.slice(1).join(' ');
  const second = tail.length > maxChars ? `${tail.slice(0, maxChars - 1)}…` : tail;
  return [lines[0], second];
}

const BlueprintArchitectureCanvas: React.FC<BlueprintArchitectureCanvasProps> = ({
  data,
  iconMap,
  personaIconUrl,
  author,
  legendPosition,
}) => {
  const { width: cW, height: cH } = data.canvas;
  const resolvedLegend = resolveLegendPosition(legendPosition, cW, cH);
  const hostWidth = resolvedLegend === 'right' ? cW + LEGEND_RIGHT_WIDTH + 32 : cW + 96;

  const nodeById = useMemo(() => {
    const m = new Map<string, BpNode>();
    for (const n of data.nodes) m.set(n.id, n);
    return m;
  }, [data]);

  // Sort zones so parents render before children (parents have no `parent`).
  const orderedZones = useMemo(() => {
    const parents: BpZone[] = [];
    const children: BpZone[] = [];
    for (const z of data.zones || []) (z.parent ? children : parents).push(z);
    return [...parents, ...children];
  }, [data]);

  // Compute edge geometry + collision-avoided badge positions once, so paths
  // can render beneath node tiles while badges + labels render on top of them.
  type PlacedEdge = {
    e: typeof data.edges[number];
    a: BpNode;
    b: BpNode;
    geom: EdgeGeom;
    bx: number; // badge center x
    by: number; // badge center y
    labelText: string; // truncated label ('' if none)
    lx: number; // label box center x
    ly: number; // label text baseline y
    lw: number; // label box width
  };
  const placedEdges = useMemo<PlacedEdge[]>(() => {
    const LABEL_FONT = '14px Arial';
    const LABEL_H = 18;

    // ── Keep-out regions that annotations must never cover ──────────────────
    // Node tiles + their two-line name band below the icon.
    const nodeRects: Rect[] = data.nodes.map((n) => ({
      x1: n.x - 4,
      y1: n.y - 2,
      x2: n.x + NODE_W + 4,
      y2: n.y + NODE_H + 6,
    }));
    // Zone header strips (the uppercase title rendered at the zone's top-left).
    const zoneHeaderRects: Rect[] = (data.zones || []).map((z) => {
      const w = measureTextWidth((z.label || '').toUpperCase(), '700 13px Arial');
      // letterSpacing 0.08em ≈ 1px per char; pad generously.
      const padded = w + (z.label?.length || 0) + 28;
      return {
        x1: z.x,
        y1: z.y,
        x2: z.x + Math.min(z.width, padded),
        y2: z.y + 30,
      };
    });

    // Pre-pass: count parallel edges (unordered node pairs) so we can
    // offset their badges perpendicular to the dominant direction.
    const pairCount = new Map<string, number>();
    for (const e of data.edges) {
      const k = [e.from, e.to].sort().join('|');
      pairCount.set(k, (pairCount.get(k) || 0) + 1);
    }
    const pairSeen = new Map<string, number>();

    // ── Pass A: place numbered badges (avoid node tiles + each other) ───────
    type Badge = {
      e: typeof data.edges[number];
      a: BpNode;
      b: BpNode;
      geom: EdgeGeom;
      bx: number;
      by: number;
    };
    const badges: Badge[] = [];
    for (const e of data.edges) {
      const a = nodeById.get(e.from);
      const b = nodeById.get(e.to);
      if (!a || !b) continue;

      const k = [e.from, e.to].sort().join('|');
      const idx = pairSeen.get(k) || 0;
      pairSeen.set(k, idx + 1);
      const count = pairCount.get(k) || 1;
      const parallelOffset = count > 1 ? (idx - (count - 1) / 2) * 36 : 0;

      const geom = computeEdgeGeometry(a, b, e, data.nodes);
      const longest = geom.longest;
      let mx = (longest.x1 + longest.x2) / 2;
      let my = (longest.y1 + longest.y2) / 2;
      if (longest.horiz) my += parallelOffset; else mx += parallelOffset;

      // Cross-pair collision avoidance: nudge a badge that lands within
      // threshold px of an already-placed one. Threshold exceeds the badge
      // diameter (2*BADGE_R) so circles never touch.
      let extra = 0;
      const threshold = BADGE_R * 2 + 6;
      const nudge = BADGE_R * 2 + 6;
      for (let iter = 0; iter < 6; iter++) {
        let collided = false;
        const tx = longest.horiz ? mx : mx + extra;
        const ty = longest.horiz ? my + extra : my;
        for (const p of badges) {
          if (Math.hypot(tx - p.bx, ty - p.by) < threshold) {
            extra += extra >= 0 ? nudge : -nudge;
            extra = -extra;
            collided = true;
            break;
          }
        }
        if (!collided) break;
      }
      let finalBx = longest.horiz ? mx : mx + extra;
      let finalBy = longest.horiz ? my + extra : my;

      // Label-band avoidance: a badge (r=BADGE_R) must not cover a node tile or
      // its name band; push it fully clear by its radius.
      const koTop = (n: BpNode) => n.y - 2;
      const koBot = (n: BpNode) => n.y + NODE_H + 6;
      const koLeft = (n: BpNode) => n.x - 6;
      const koRight = (n: BpNode) => n.x + NODE_W + 6;
      // Unified resolution: re-check ALL constraints (node tiles, zone-header
      // strips, and already-placed badges) on every iteration. Resolving them
      // in separate sequential passes lets the last pass shove a badge back
      // onto a tile/header it was just cleared from; a single loop that
      // re-tests everything after each nudge avoids that interference.
      for (let iter = 0; iter < 16; iter++) {
        let collided = false;
        // 1. Node tiles + name bands.
        for (const n of data.nodes) {
          const inX = finalBx > koLeft(n) - BADGE_R && finalBx < koRight(n) + BADGE_R;
          const inY = finalBy > koTop(n) - BADGE_R && finalBy < koBot(n) + BADGE_R;
          if (!inX || !inY) continue;
          if (longest.horiz) {
            const up = koTop(n) - BADGE_R - 2;
            const down = koBot(n) + BADGE_R + 2;
            finalBy = Math.abs(finalBy - up) <= Math.abs(finalBy - down) ? up : down;
          } else {
            const left = koLeft(n) - BADGE_R - 2;
            const right = koRight(n) + BADGE_R + 2;
            finalBx = Math.abs(finalBx - left) <= Math.abs(finalBx - right) ? left : right;
          }
          collided = true;
          break;
        }
        if (collided) continue;
        // 2. Zone-header strips: never cover the uppercase title. Headers are
        // thin horizontal bands, so push the badge vertically clear.
        for (const zh of zoneHeaderRects) {
          const inX = finalBx > zh.x1 - BADGE_R && finalBx < zh.x2 + BADGE_R;
          const inY = finalBy > zh.y1 - BADGE_R && finalBy < zh.y2 + BADGE_R;
          if (!inX || !inY) continue;
          const up = zh.y1 - BADGE_R - 2;
          const down = zh.y2 + BADGE_R + 2;
          finalBy = Math.abs(finalBy - up) <= Math.abs(finalBy - down) ? up : down;
          collided = true;
          break;
        }
        if (collided) continue;
        // 3. Other badges: keep circle centers at least `threshold` apart.
        for (const p of badges) {
          if (Math.hypot(finalBx - p.bx, finalBy - p.by) < threshold) {
            if (longest.horiz) finalBy += finalBy >= p.by ? nudge : -nudge;
            else finalBx += finalBx >= p.bx ? nudge : -nudge;
            collided = true;
            break;
          }
        }
        if (!collided) break;
      }

      badges.push({ e, a, b, geom, bx: finalBx, by: finalBy });
    }

    // Badge circles become keep-out rects for the label pass.
    const badgeRects: Rect[] = badges.map((p) => ({
      x1: p.bx - BADGE_R,
      y1: p.by - BADGE_R,
      x2: p.bx + BADGE_R,
      y2: p.by + BADGE_R,
    }));

    // ── Pass B: place labels — avoid node tiles, zone headers, badges, AND
    // every other label. Labels are placed in step order for determinism;
    // each placed label becomes an obstacle for the next.
    const placedLabelRects: Rect[] = [];
    const ordered = [...badges].sort((p, q) => {
      const sp = p.e.step ?? 1e9;
      const sq = q.e.step ?? 1e9;
      return sp !== sq ? sp - sq : String(p.e.id).localeCompare(String(q.e.id));
    });
    const labelById = new Map<string, { lx: number; ly: number; lw: number; text: string }>();

    for (const p of ordered) {
      if (!p.e.label) continue;
      const text = truncate(p.e.label, 24);
      const lw = Math.max(34, measureTextWidth(text, LABEL_FONT) + 14);
      const horiz = p.geom.horizontal;
      const baseX = p.bx;
      const baseY = p.e.step !== undefined ? p.by - 26 : p.by - 10;

      const rectAt = (cx: number, cy: number): Rect => ({
        x1: cx - lw / 2 - 2,
        y1: cy - LABEL_H + 3,
        x2: cx + lw / 2 + 2,
        y2: cy + 4,
      });
      const free = (cx: number, cy: number): boolean => {
        const r = rectAt(cx, cy);
        for (const k of nodeRects) if (rectsOverlap(r, k)) return false;
        for (const k of zoneHeaderRects) if (rectsOverlap(r, k)) return false;
        for (const k of badgeRects) if (rectsOverlap(r, k)) return false;
        for (const k of placedLabelRects) if (rectsOverlap(r, k)) return false;
        return true;
      };

      // Candidate slots, nearest first: slide along the edge's dominant axis,
      // then stack perpendicular (above/below) to dodge crowded corridors.
      const candidates: Array<{ x: number; y: number }> = [{ x: baseX, y: baseY }];
      const step = 16;
      for (let i = 1; i <= 14; i++) {
        for (const dir of [-1, 1]) {
          if (horiz) candidates.push({ x: baseX + dir * i * step, y: baseY });
          else candidates.push({ x: baseX, y: baseY + dir * i * step });
        }
        candidates.push({ x: baseX, y: baseY - i * (LABEL_H + 4) });
        candidates.push({ x: baseX, y: baseY + i * (LABEL_H + 4) });
      }

      let chosen = candidates[0];
      for (const c of candidates) {
        if (free(c.x, c.y)) {
          chosen = c;
          break;
        }
      }
      placedLabelRects.push(rectAt(chosen.x, chosen.y));
      labelById.set(p.e.id, { lx: chosen.x, ly: chosen.y, lw, text });
    }

    return badges.map((p) => {
      const lbl = labelById.get(p.e.id);
      return {
        e: p.e,
        a: p.a,
        b: p.b,
        geom: p.geom,
        bx: p.bx,
        by: p.by,
        labelText: lbl?.text ?? '',
        lx: lbl?.lx ?? p.bx,
        ly: lbl?.ly ?? p.by,
        lw: lbl?.lw ?? 0,
      };
    });
  }, [data, nodeById]);

  return (
    <div
      className="bp-arch-canvas"
      data-bp-arch-canvas="true"
      data-bp-arch-legend={resolvedLegend}
      style={{ width: hostWidth }}
    >
      <header className="bp-arch-header">
        <div>
          <div className="bp-arch-eyebrow">Blueprint Architecture</div>
          <h1 className="bp-arch-title">{data.title}</h1>
        </div>
        {author && <div className="bp-arch-author">{author}</div>}
      </header>

      <div className={`bp-arch-body bp-arch-body--${resolvedLegend}`}>
      <svg
        className="bp-arch-svg"
        viewBox={`0 0 ${cW} ${cH}`}
        width={cW}
        height={cH}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker
            id="bp-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="9"
            markerHeight="9"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#1f2937" />
          </marker>
        </defs>

        {/* Zones (nested, parents first) */}
        {orderedZones.map((z) => (
          <ZoneRect key={z.id} zone={z} />
        ))}

        {/* Edges drawn between zones and nodes so they sit beneath node tiles
            but above zone fills. Only the connector paths render here; the
            numbered badges + labels render in a later pass (after the node
            tiles) so they are never hidden behind a tile. */}
        <g className="bp-edges">
          {placedEdges.map((p) => (
            <path
              key={`${p.e.id}-path`}
              d={p.geom.d}
              fill="none"
              stroke="#1f2937"
              strokeWidth={1.6}
              strokeDasharray={p.geom.strokeDash}
              markerEnd="url(#bp-arrow)"
            />
          ))}
        </g>

        {/* Nodes on top */}
        <g className="bp-nodes">
          {data.nodes.map((n) => (
            <Node
              key={n.id}
              node={n}
              preloadedIconUrl={iconMap?.[n.name]}
              personaIconUrl={personaIconUrl}
            />
          ))}
        </g>

        {/* Edge badges + labels render last so they always sit on top of the
            node tiles and remain legible. */}
        <g className="bp-edge-decor">
          {placedEdges.map((p) => (
            <EdgeDecor
              key={`${p.e.id}-decor`}
              edge={p.e}
              badgeX={p.bx}
              badgeY={p.by}
              labelText={p.labelText}
              labelX={p.lx}
              labelY={p.ly}
              labelW={p.lw}
            />
          ))}
        </g>
      </svg>

      {data.workflow && data.workflow.length > 0 && (
        <ol className="bp-arch-workflow">
          {data.workflow.map((step) => (
            <li key={step.step}>
              <span className="bp-step-badge">{step.step}</span>
              <span className="bp-step-text">{step.description}</span>
            </li>
          ))}
        </ol>
      )}
      </div>
    </div>
  );
};

// ─── Zone ────────────────────────────────────────────────────────────────────

const ZONE_PALETTE: Record<string, { fill: string; stroke: string; label: string }> = {
  azure:     { fill: '#ede9fe', stroke: '#8b5cf6', label: '#5b21b6' },
  onprem:    { fill: '#fce7f3', stroke: '#ec4899', label: '#9d174d' },
  vnet:      { fill: '#dbeafe', stroke: '#3b82f6', label: '#1e40af' },
  subnet:    { fill: '#e0f2fe', stroke: '#0284c7', label: '#075985' },
  rg:        { fill: '#fef9c3', stroke: '#eab308', label: '#854d0e' },
  external:  { fill: '#f3f4f6', stroke: '#6b7280', label: '#374151' },
  subsystem: { fill: '#dcfce7', stroke: '#22c55e', label: '#166534' },
};

const ZoneRect: React.FC<{ zone: BpZone }> = ({ zone }) => {
  const p = ZONE_PALETTE[zone.kind || 'subsystem'] || ZONE_PALETTE.subsystem;
  return (
    <g className="bp-zone">
      <rect
        x={zone.x}
        y={zone.y}
        width={zone.width}
        height={zone.height}
        rx={14}
        ry={14}
        fill={p.fill}
        stroke={p.stroke}
        strokeWidth={1.5}
        strokeDasharray="6 4"
        opacity={0.75}
      />
      <text
        x={zone.x + 14}
        y={zone.y + 22}
        fill={p.label}
        fontSize={13}
        fontWeight={700}
        style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
      >
        {zone.label}
      </text>
    </g>
  );
};

// ─── Node ────────────────────────────────────────────────────────────────────

const Node: React.FC<{
  node: BpNode;
  preloadedIconUrl?: string;
  personaIconUrl?: string;
}> = ({ node, preloadedIconUrl, personaIconUrl }) => {
  const [iconUrl, setIconUrl] = useState<string>(
    node.kind === 'persona' && personaIconUrl ? personaIconUrl : preloadedIconUrl || '',
  );
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (node.kind === 'persona' && personaIconUrl) {
      setIconUrl(personaIconUrl);
      return;
    }
    if (preloadedIconUrl) {
      setIconUrl(preloadedIconUrl);
      return;
    }
    const mapping = resolveServiceIconLoose(node.name) || getServiceIconMapping(node.name);
    if (!mapping) return;
    const path = `/Azure_Public_Service_Icons/Icons/${mapping.iconCategory ?? mapping.category}/${mapping.iconFile}.svg`;
    loadIcon(path).then((url) => {
      if (mountedRef.current) setIconUrl(url);
    });
    return () => {
      mountedRef.current = false;
    };
  }, [node.name, node.kind, preloadedIconUrl, personaIconUrl]);

  const isCloud = node.kind === 'cloud';
  const cx = node.x + NODE_W / 2;
  const iconTop = node.y + 12;

  return (
    <g className="bp-node" data-kind={node.kind || 'service'}>
      {isCloud ? (
        <path
          d={cloudPath(node.x, node.y, NODE_W, NODE_H - 22)}
          fill="#ffffff"
          stroke="#0ea5e9"
          strokeWidth={1.5}
        />
      ) : (
        <rect
          x={node.x}
          y={node.y}
          width={NODE_W}
          height={NODE_H - 22}
          rx={10}
          ry={10}
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth={1}
        />
      )}

      {iconUrl ? (
        <image
          href={iconUrl}
          x={cx - ICON / 2}
          y={iconTop}
          width={ICON}
          height={ICON}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <FallbackGlyph cx={cx} cy={iconTop + ICON / 2} name={node.name} />
      )}

      <text
        x={cx}
        y={node.y + NODE_H - 6}
        textAnchor="middle"
        fontSize={11}
        fontWeight={500}
        fill="#111827"
      >
        {(() => {
          const lines = wrapLabel(node.name);
          if (lines.length === 1) return lines[0];
          // Two lines: lift line 1 and let line 2 sit on the original baseline.
          // The 8px overhang below the tile footprint is intentional and
          // matches the slack reserved by the authored layout.
          return (
            <>
              <tspan x={cx} dy={-LABEL_LINE_H}>{lines[0]}</tspan>
              <tspan x={cx} dy={LABEL_LINE_H}>{lines[1]}</tspan>
            </>
          );
        })()}
      </text>
    </g>
  );
};

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

// Measure rendered text width. Uses a cached <canvas> 2D context when a DOM is
// available (both the on-screen view and the off-screen PNG export run in a
// browser), falling back to a per-character estimate otherwise. Accurate widths
// keep label background boxes the right size so collision tests are reliable.
let _measureCtx: CanvasRenderingContext2D | null | undefined;
function measureTextWidth(text: string, font: string): number {
  if (_measureCtx === undefined) {
    try {
      _measureCtx =
        typeof document !== 'undefined'
          ? document.createElement('canvas').getContext('2d')
          : null;
    } catch {
      _measureCtx = null;
    }
  }
  if (_measureCtx) {
    _measureCtx.font = font;
    return _measureCtx.measureText(text).width;
  }
  return text.length * (parseFloat(font) || 14) * 0.55;
}

type Rect = { x1: number; y1: number; x2: number; y2: number };
function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

/** Initials-on-blue-tile fallback for nodes with no resolvable icon. */
const FallbackGlyph: React.FC<{ cx: number; cy: number; name: string }> = ({ cx, cy, name }) => {
  const initials = name
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || '?';
  return (
    <g>
      <rect
        x={cx - ICON / 2}
        y={cy - ICON / 2}
        width={ICON}
        height={ICON}
        rx={8}
        fill="#dbeafe"
        stroke="#3b82f6"
        strokeWidth={1}
      />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        fontSize={16}
        fontWeight={700}
        fill="#1e40af"
      >
        {initials}
      </text>
    </g>
  );
};

// ─── Edge decoration (badge + label) ─────────────────────────────────────────
// The SVG <path> itself is rendered in the parent's first pass so that the
// later badge pass paints above every path. This component renders only the
// numbered badge and the label. Both their positions are resolved globally by
// the parent's placedEdges pass (collision-avoided against tiles, zone headers,
// other badges, and other labels); this component is a pure renderer.

const EdgeDecor: React.FC<{
  edge: { id: string; step?: number; label?: string };
  badgeX: number;
  badgeY: number;
  labelText: string;
  labelX: number;
  labelY: number;
  labelW: number;
}> = ({ edge, badgeX, badgeY, labelText, labelX, labelY, labelW }) => {
  const mx = badgeX;
  const my = badgeY;
  const labelH = 18;

  return (
    <g className="bp-edge-decor">
      {edge.step !== undefined && (
        <g>
          {/* White halo so the badge stays readable when crowded against a node tile */}
          <circle cx={mx} cy={my} r={BADGE_R} fill="#ffffff" />
          <circle cx={mx} cy={my} r={BADGE_R - 2} fill="#2563eb" stroke="#ffffff" strokeWidth={2} />
          <text
            x={mx}
            y={my + 6}
            textAnchor="middle"
            fontSize={17}
            fontWeight={700}
            fill="#ffffff"
          >
            {edge.step}
          </text>
        </g>
      )}
      {labelText && (
        <g>
          <rect
            x={labelX - labelW / 2}
            y={labelY - 13}
            width={labelW}
            height={labelH}
            rx={3}
            ry={3}
            fill="#ffffff"
            fillOpacity={0.92}
          />
          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            fontSize={14}
            fill="#374151"
          >
            {labelText}
          </text>
        </g>
      )}
    </g>
  );
};

// ─── Cloud shape (for network gateways like Site-to-Site VPN) ───────────────

function cloudPath(x: number, y: number, w: number, h: number): string {
  // Simple cloud silhouette via four arcs.
  const cy = y + h * 0.65;
  const r1 = h * 0.35;
  const r2 = h * 0.45;
  const r3 = h * 0.4;
  const r4 = h * 0.32;
  const x1 = x + w * 0.2;
  const x2 = x + w * 0.4;
  const x3 = x + w * 0.65;
  const x4 = x + w * 0.85;
  return [
    `M ${x} ${cy}`,
    `Q ${x} ${cy - r1 * 1.6} ${x1} ${cy - r1}`,
    `Q ${x1 + r2 * 0.4} ${cy - r2 * 1.4} ${x2} ${cy - r2}`,
    `Q ${x3 - r3} ${cy - r3 * 1.6} ${x3} ${cy - r3}`,
    `Q ${x4} ${cy - r4 * 1.4} ${x + w} ${cy}`,
    `Q ${x + w} ${cy + h * 0.3} ${x4} ${y + h}`,
    `L ${x1} ${y + h}`,
    `Q ${x} ${cy + h * 0.3} ${x} ${cy}`,
    'Z',
  ].join(' ');
}

export default BlueprintArchitectureCanvas;
