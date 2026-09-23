// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Blueprint auto-layout (Phase 2)
 * -------------------------------
 * Replaces the AI-authored absolute coordinates with a computed layout from
 * the Eclipse Layout Kernel (elkjs). The AI still decides *structure* — which
 * services exist, how they nest into zones, and how edges connect them — but
 * ELK decides *where everything goes*, eliminating the overlaps and cramped
 * spacing that hand-authored coordinates produced.
 *
 * Zones map to ELK compound (container) nodes; service nodes map to fixed-size
 * ELK leaf nodes; edges are declared at the root with INCLUDE_CHILDREN so ELK
 * routes cross-zone connections. We only consume ELK's node/zone geometry —
 * the SVG renderer still draws its own obstacle-aware edges from the resulting
 * positions.
 */

import ELK from 'elkjs/lib/elk.bundled.js';
import type { BlueprintArchitecture, BpNode, BpZone } from './blueprintArchitectureAI';

// Must match the renderer's tile footprint (BlueprintArchitectureCanvas.tsx).
const NODE_W = 180;
const NODE_H = 120;
// Breathing room added to the right/bottom of the canvas so arrowheads and
// edge-label chips near the far edges are never clipped.
const CANVAS_MARGIN = 48;

const elk = new ELK();

// Layout tuning. Generous spacing leaves room for the numbered step badges and
// edge-label chips the SVG renderer draws between tiles.
const ROOT_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.layered.spacing.nodeNodeBetweenLayers': '170',
  'elk.layered.spacing.edgeNodeBetweenLayers': '50',
  'elk.spacing.nodeNode': '90',
  'elk.spacing.edgeNode': '45',
  'elk.spacing.edgeEdge': '30',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.padding': '[top=56,left=56,bottom=56,right=56]',
};

// Compound (zone) container options: extra top padding leaves room for the
// zone's title label, which the renderer draws inside the top edge.
const ZONE_OPTIONS: Record<string, string> = {
  'elk.padding': '[top=60,left=36,bottom=36,right=36]',
  'elk.spacing.nodeNode': '80',
};

interface ElkNode {
  id: string;
  width?: number;
  height?: number;
  layoutOptions?: Record<string, string>;
  children?: ElkNode[];
  x?: number;
  y?: number;
}

interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
}

/**
 * Compute a fresh layout for a blueprint. Returns a NEW object with updated
 * zone bounds, node positions, and canvas size. On any failure the original
 * blueprint is returned unchanged so callers can fall back gracefully.
 */
export async function layoutBlueprint(bp: BlueprintArchitecture): Promise<BlueprintArchitecture> {
  if (!bp.nodes?.length) return bp;

  const zoneById = new Map<string, BpZone>((bp.zones || []).map((z) => [z.id, z]));
  const nodeById = new Map<string, BpNode>(bp.nodes.map((n) => [n.id, n]));

  // Resolve a valid container id for a zone/node (falls back to root when the
  // referenced parent/zone doesn't exist).
  const zoneParentId = (z: BpZone) => (z.parent && zoneById.has(z.parent) ? z.parent : null);
  const nodeZoneId = (n: BpNode) => (n.zone && zoneById.has(n.zone) ? n.zone : null);

  // Build ELK container nodes for every zone.
  const elkZones = new Map<string, ElkNode>();
  for (const z of bp.zones || []) {
    elkZones.set(z.id, { id: z.id, layoutOptions: { ...ZONE_OPTIONS }, children: [] });
  }

  const rootChildren: ElkNode[] = [];

  // Nest zones under their parent zone (or root).
  for (const z of bp.zones || []) {
    const elkZone = elkZones.get(z.id)!;
    const pid = zoneParentId(z);
    if (pid) elkZones.get(pid)!.children!.push(elkZone);
    else rootChildren.push(elkZone);
  }

  // Place service nodes into their zone (or root).
  for (const n of bp.nodes) {
    const leaf: ElkNode = { id: n.id, width: NODE_W, height: NODE_H };
    const zid = nodeZoneId(n);
    if (zid) elkZones.get(zid)!.children!.push(leaf);
    else rootChildren.push(leaf);
  }

  // All edges at the root; INCLUDE_CHILDREN lets ELK resolve nested endpoints.
  const elkEdges: ElkEdge[] = (bp.edges || [])
    .filter((e) => nodeById.has(e.from) && nodeById.has(e.to))
    .map((e) => ({ id: e.id, sources: [e.from], targets: [e.to] }));

  const graph: ElkNode & { edges: ElkEdge[] } = {
    id: 'root',
    layoutOptions: { ...ROOT_OPTIONS },
    children: rootChildren,
    edges: elkEdges,
  };

  let laidOut: ElkNode;
  try {
    laidOut = (await elk.layout(graph as any)) as ElkNode;
  } catch (err) {
    console.warn('[blueprintLayout] ELK layout failed; keeping original coordinates.', err);
    return bp;
  }

  // Flatten ELK's parent-relative coordinates into absolute canvas coordinates.
  const absZones = new Map<string, { x: number; y: number; width: number; height: number }>();
  const absNodes = new Map<string, { x: number; y: number }>();
  let maxX = 0;
  let maxY = 0;

  const walk = (node: ElkNode, offsetX: number, offsetY: number) => {
    const ax = offsetX + (node.x || 0);
    const ay = offsetY + (node.y || 0);
    if (node.id !== 'root') {
      const w = node.width || NODE_W;
      const h = node.height || NODE_H;
      maxX = Math.max(maxX, ax + w);
      maxY = Math.max(maxY, ay + h);
      if (zoneById.has(node.id)) {
        absZones.set(node.id, { x: ax, y: ay, width: w, height: h });
      } else if (nodeById.has(node.id)) {
        absNodes.set(node.id, { x: ax, y: ay });
      }
    }
    for (const child of node.children || []) walk(child, ax, ay);
  };
  walk(laidOut, 0, 0);

  // Produce a new blueprint with the computed geometry.
  const zones: BpZone[] = (bp.zones || []).map((z) => {
    const a = absZones.get(z.id);
    return a ? { ...z, x: a.x, y: a.y, width: a.width, height: a.height } : z;
  });
  const nodes: BpNode[] = bp.nodes.map((n) => {
    const a = absNodes.get(n.id);
    return a ? { ...n, x: a.x, y: a.y } : n;
  });

  return {
    ...bp,
    zones,
    nodes,
    canvas: {
      width: Math.ceil(maxX + CANVAS_MARGIN),
      height: Math.ceil(maxY + CANVAS_MARGIN),
    },
  };
}
