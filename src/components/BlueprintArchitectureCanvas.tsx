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
}

const NODE_W = 150;
const NODE_H = 100;
const ICON = 44;
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
}) => {
  const { width: cW, height: cH } = data.canvas;

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

  return (
    <div
      className="bp-arch-canvas"
      data-bp-arch-canvas="true"
      style={{ width: cW + 96 }}
    >
      <header className="bp-arch-header">
        <div>
          <div className="bp-arch-eyebrow">Blueprint Architecture</div>
          <h1 className="bp-arch-title">{data.title}</h1>
        </div>
        {author && <div className="bp-arch-author">{author}</div>}
      </header>

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
            but above zone fills. Paths render first, then badges + labels so
            no later edge can paint over an earlier badge. */}
        <g className="bp-edges">
          {(() => {
            // Pre-pass: count parallel edges (unordered node pairs) so we can
            // offset their badges perpendicular to the dominant direction.
            const pairCount = new Map<string, number>();
            for (const e of data.edges) {
              const k = [e.from, e.to].sort().join('|');
              pairCount.set(k, (pairCount.get(k) || 0) + 1);
            }
            const pairSeen = new Map<string, number>();

            type Placed = {
              e: typeof data.edges[number];
              a: BpNode;
              b: BpNode;
              geom: EdgeGeom;
              bx: number;            // badge x
              by: number;            // badge y
            };
            const placed: Placed[] = [];
            for (const e of data.edges) {
              const a = nodeById.get(e.from);
              const b = nodeById.get(e.to);
              if (!a || !b) continue;

              const k = [e.from, e.to].sort().join('|');
              const idx = pairSeen.get(k) || 0;
              pairSeen.set(k, idx + 1);
              const count = pairCount.get(k) || 1;
              const parallelOffset = count > 1 ? (idx - (count - 1) / 2) * 28 : 0;

              const geom = computeEdgeGeometry(a, b, e, data.nodes);
              const longest = geom.longest;
              let mx = (longest.x1 + longest.x2) / 2;
              let my = (longest.y1 + longest.y2) / 2;
              if (longest.horiz) my += parallelOffset; else mx += parallelOffset;

              // Cross-pair collision avoidance: if our badge lands within 26 px
              // of an already-placed one, nudge along the longest segment's
              // perpendicular axis (alternating direction).
              let extra = 0;
              const threshold = 26;
              for (let iter = 0; iter < 6; iter++) {
                let collided = false;
                const tx = longest.horiz ? mx : mx + extra;
                const ty = longest.horiz ? my + extra : my;
                for (const p of placed) {
                  const ddx = tx - p.bx;
                  const ddy = ty - p.by;
                  if (Math.hypot(ddx, ddy) < threshold) {
                    extra += extra >= 0 ? 28 : -28;
                    extra = -extra;
                    collided = true;
                    break;
                  }
                }
                if (!collided) break;
              }
              const finalBx = longest.horiz ? mx : mx + extra;
              const finalBy = longest.horiz ? my + extra : my;
              placed.push({ e, a, b, geom, bx: finalBx, by: finalBy });
            }

            return (
              <>
                {/* Pass 1: paths only — guarantees no edge line paints over a badge. */}
                {placed.map((p) => (
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
                {/* Pass 2: badges + labels on top of every path. */}
                {placed.map((p) => (
                  <EdgeDecor
                    key={`${p.e.id}-decor`}
                    edge={p.e}
                    geom={p.geom}
                    badgeX={p.bx}
                    badgeY={p.by}
                    allNodes={data.nodes}
                  />
                ))}
              </>
            );
          })()}
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
    const path = `/Azure_Public_Service_Icons/Icons/${mapping.category}/${mapping.iconFile}.svg`;
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
// numbered badge and the label, both of which need to sit above all edges.

const EdgeDecor: React.FC<{
  edge: { id: string; step?: number; label?: string };
  geom: EdgeGeom;
  badgeX: number;
  badgeY: number;
  allNodes: BpNode[];
}> = ({ edge, geom, badgeX, badgeY, allNodes }) => {
  const mx = badgeX;
  const my = badgeY;
  const { ax, ay, bx, by, horizontal } = geom;

  return (
    <g className="bp-edge-decor">
      {edge.step !== undefined && (
        <g>
          {/* White halo so the badge stays readable when crowded against a node tile */}
          <circle cx={mx} cy={my} r={13} fill="#ffffff" />
          <circle cx={mx} cy={my} r={11} fill="#2563eb" stroke="#ffffff" strokeWidth={1.5} />
          <text
            x={mx}
            y={my + 4}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="#ffffff"
          >
            {edge.step}
          </text>
        </g>
      )}
      {edge.label && (() => {
        const label = truncate(edge.label, 24);
        const labelW = Math.max(28, label.length * 6.2 + 10);
        const labelH = 14;
        let lx = mx;
        const baseLy = edge.step !== undefined ? my - 20 : my - 8;
        let ly = baseLy;

        // Collision avoidance: if label rect overlaps any node tile, slide
        // along the dominant axis toward whichever endpoint has more clearance.
        const labelOverlapsNode = (cx: number, cy: number) => {
          const rx1 = cx - labelW / 2 - 2;
          const rx2 = cx + labelW / 2 + 2;
          const ry1 = cy - labelH - 2;
          const ry2 = cy + 2;
          for (const n of allNodes) {
            const nx1 = n.x;
            const nx2 = n.x + NODE_W;
            const ny1 = n.y;
            const ny2 = n.y + (NODE_H - 22);
            if (rx1 < nx2 && rx2 > nx1 && ry1 < ny2 && ry2 > ny1) return true;
          }
          return false;
        };

        if (labelOverlapsNode(lx, ly)) {
          const span = horizontal ? Math.abs(bx - ax) : Math.abs(by - ay);
          const step = 16;
          const maxSteps = Math.max(2, Math.floor(span / (step * 2)));
          let placedLabel = false;
          for (let i = 1; i <= maxSteps && !placedLabel; i++) {
            const delta = i * step;
            for (const dir of [1, -1]) {
              const tryX = horizontal ? mx + dir * delta : mx;
              const tryY = horizontal ? baseLy : baseLy + dir * delta;
              if (!labelOverlapsNode(tryX, tryY)) {
                lx = tryX;
                ly = tryY;
                placedLabel = true;
                break;
              }
            }
          }
        }

        return (
          <g>
            <rect
              x={lx - labelW / 2}
              y={ly - 10}
              width={labelW}
              height={labelH}
              rx={3}
              ry={3}
              fill="#ffffff"
              fillOpacity={0.92}
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              fontSize={11}
              fill="#374151"
            >
              {label}
            </text>
          </g>
        );
      })()}
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
