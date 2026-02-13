import type { Edge, Node } from 'reactflow';
import { relayoutDiagram } from './layoutEngine';
import { relayoutDiagram as elkRelayoutDiagram } from './elkLayoutEngine';

export type LayoutEngineType = 'dagre' | 'elk';

export type LayoutPreset = 'flow-lr' | 'flow-tb' | 'swimlanes' | 'radial';
export type LayoutSpacing = 'compact' | 'comfortable';
export type LayoutEdgeStyle = 'straight' | 'smooth' | 'orthogonal';

export interface ApplyLayoutOptions {
  preset: LayoutPreset;
  spacing: LayoutSpacing;
  edgeStyle: LayoutEdgeStyle;
  emphasizePrimaryPath: boolean;
  selectedNodeId?: string;
  layoutEngine?: LayoutEngineType;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 100;

function getSpacing(spacing: LayoutSpacing) {
  if (spacing === 'compact') {
    return {
      nodeSpacing: 110,
      rankSpacing: 140,
      groupPadding: 60,
      laneGap: 80,
      radialBaseRadius: 170,
      radialRingStep: 160,
    };
  }

  return {
    nodeSpacing: 150,
    rankSpacing: 200,
    groupPadding: 80,
    laneGap: 120,
    radialBaseRadius: 220,
    radialRingStep: 200,
  };
}

function withEdgeStyle(edges: Edge[], edgeStyle: LayoutEdgeStyle): Edge[] {
  return edges.map((e) => ({
    ...e,
    data: { ...(e.data ?? {}), pathStyle: edgeStyle },
  }));
}

type Dir = 'forward' | 'reverse' | 'bidirectional';

function normalizeDirectedAdjacency(nodes: Node[], edges: Edge[]) {
  const azureIds = new Set(nodes.filter((n) => n.type === 'azureNode').map((n) => n.id));

  const out = new Map<string, Set<string>>();
  const indeg = new Map<string, number>();
  const outdeg = new Map<string, number>();

  for (const id of azureIds) {
    out.set(id, new Set());
    indeg.set(id, 0);
    outdeg.set(id, 0);
  }

  const addEdge = (a: string, b: string) => {
    if (!azureIds.has(a) || !azureIds.has(b)) return;
    const s = out.get(a);
    if (!s) return;
    if (!s.has(b)) {
      s.add(b);
      outdeg.set(a, (outdeg.get(a) ?? 0) + 1);
      indeg.set(b, (indeg.get(b) ?? 0) + 1);
    }
  };

  for (const e of edges) {
    const dir = ((e.data as any)?.direction ?? 'forward') as Dir;
    if (dir === 'reverse') {
      addEdge(e.target, e.source);
    } else if (dir === 'bidirectional') {
      addEdge(e.source, e.target);
      addEdge(e.target, e.source);
    } else {
      addEdge(e.source, e.target);
    }
  }

  return { azureIds, out, indeg, outdeg };
}

function pickMostConnectedNode(nodes: Node[], edges: Edge[]): string | undefined {
  const { azureIds, indeg, outdeg } = normalizeDirectedAdjacency(nodes, edges);

  let best: { id: string; score: number } | undefined;
  for (const id of azureIds) {
    const score = (indeg.get(id) ?? 0) + (outdeg.get(id) ?? 0);
    if (!best || score > best.score) best = { id, score };
  }

  return best?.id;
}

function computePrimaryChain(nodes: Node[], edges: Edge[]): string[] {
  const { azureIds, out, indeg, outdeg } = normalizeDirectedAdjacency(nodes, edges);

  const entries = [...azureIds].filter((id) => (indeg.get(id) ?? 0) === 0);
  const startCandidates = entries.length > 0 ? entries : [...azureIds];

  let start: string | undefined;
  for (const id of startCandidates) {
    const score = outdeg.get(id) ?? 0;
    if (!start || score > (outdeg.get(start) ?? 0)) start = id;
  }

  if (!start) return [];

  const chain: string[] = [start];
  const visited = new Set(chain);

  while (true) {
    const cur = chain[chain.length - 1];
    const nextCandidates = [...(out.get(cur) ?? new Set())].filter((n) => !visited.has(n));
    if (nextCandidates.length === 0) break;

    nextCandidates.sort((a, b) => {
      const da = outdeg.get(a) ?? 0;
      const db = outdeg.get(b) ?? 0;
      return db - da;
    });

    const next = nextCandidates[0];
    chain.push(next);
    visited.add(next);

    if (chain.length > 64) break; // guardrail
  }

  return chain;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function straightenPrimaryPath(nodes: Node[], edges: Edge[], direction: 'LR' | 'TB') {
  const chain = computePrimaryChain(nodes, edges);
  if (chain.length < 3) return { nodes, edges };

  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const chainNodes = chain.map((id) => byId.get(id)).filter(Boolean) as Node[];

  if (chainNodes.length < 3) return { nodes, edges };

  const axis = direction === 'LR' ? 'y' : 'x';
  const values = chainNodes
    .map((n) => (n.position as any)[axis] as number)
    .slice()
    .sort((a, b) => a - b);

  const median = values[Math.floor(values.length / 2)];

  const parentById = new Map<string, Node>();
  for (const n of nodes) {
    if (n.type === 'groupNode') parentById.set(n.id, n);
  }

  const updatedNodes = nodes.map((n) => {
    if (!chain.includes(n.id) || n.type !== 'azureNode') return n;

    // Keep node inside group bounds if it's a child.
    const parentId = (n as any).parentNode as string | undefined;
    if (parentId) {
      const parent = parentById.get(parentId);
      const width = (parent?.style as any)?.width as number | undefined;
      const height = (parent?.style as any)?.height as number | undefined;

      if (axis === 'y' && typeof height === 'number') {
        const newY = clamp(median, 0, Math.max(0, height - NODE_HEIGHT));
        return { ...n, position: { ...n.position, y: newY } };
      }
      if (axis === 'x' && typeof width === 'number') {
        const newX = clamp(median, 0, Math.max(0, width - NODE_WIDTH));
        return { ...n, position: { ...n.position, x: newX } };
      }
    }

    return {
      ...n,
      position: {
        ...n.position,
        [axis]: median,
      },
    };
  });

  // Mark chain edges as primary for optional styling.
  const chainPairs = new Set<string>();
  for (let i = 0; i < chain.length - 1; i++) {
    chainPairs.add(`${chain[i]}->${chain[i + 1]}`);
  }

  const updatedEdges = edges.map((e) => {
    const isPrimary = chainPairs.has(`${e.source}->${e.target}`) || chainPairs.has(`${e.target}->${e.source}`);
    return { ...e, data: { ...(e.data ?? {}), primaryPath: isPrimary } };
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}

async function applySwimlanesByGroup(nodes: Node[], edges: Edge[], spacing: ReturnType<typeof getSpacing>, doRelayout: RelayoutFn) {
  const groupNodes = nodes.filter((n) => n.type === 'groupNode');
  const serviceNodes = nodes.filter((n) => n.type === 'azureNode');

  // Map groupId -> members
  const membersByGroup = new Map<string, Node[]>();
  for (const g of groupNodes) membersByGroup.set(g.id, []);
  const ungrouped: Node[] = [];

  for (const n of serviceNodes) {
    const parentId = (n as any).parentNode as string | undefined;
    if (parentId && membersByGroup.has(parentId)) {
      membersByGroup.get(parentId)!.push(n);
    } else {
      ungrouped.push(n);
    }
  }

  const groupOrder = [...groupNodes].sort((a, b) => {
    const la = String((a.data as any)?.label ?? a.id);
    const lb = String((b.data as any)?.label ?? b.id);
    return la.localeCompare(lb);
  });

  let yCursor = 80;
  const updatedNodes = new Map<string, Node>();

  const edgesFor = (setIds: Set<string>) =>
    edges.filter((e) => setIds.has(e.source) && setIds.has(e.target));

  // Layout each group internally (L→R) and stack groups vertically.
  for (const g of groupOrder) {
    const members = membersByGroup.get(g.id) ?? [];

    if (members.length === 0) {
      // Keep size but position lane.
      const width = (g.style as any)?.width ?? 420;
      const height = (g.style as any)?.height ?? 260;
      updatedNodes.set(g.id, { ...g, position: { x: 80, y: yCursor }, style: { ...(g.style ?? {}), width, height } });
      yCursor += height + spacing.laneGap;
      continue;
    }

    const ids = new Set(members.map((m) => m.id));
    const subEdges = edgesFor(ids);

    // Temporarily strip parentNode so relayoutDiagram treats them as top-level,
    // then we re-apply as relative positions.
    const tempNodes: Node[] = [
      ...members.map((m) => ({ ...m, parentNode: undefined, extent: undefined } as any)),
    ];

    const laidOut = await doRelayout(tempNodes, subEdges, {
      direction: 'LR',
      nodeSpacing: spacing.nodeSpacing,
      rankSpacing: spacing.rankSpacing,
      groupPadding: spacing.groupPadding,
    });

    // Compute bounding box for members.
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of laidOut) {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + NODE_WIDTH);
      maxY = Math.max(maxY, n.position.y + NODE_HEIGHT);
    }

    const contentW = Math.max(220, maxX - minX);
    const contentH = Math.max(160, maxY - minY);

    const groupWidth = contentW + spacing.groupPadding * 2;
    const groupHeight = contentH + spacing.groupPadding * 2;

    const groupX = 80;
    const groupY = yCursor;

    updatedNodes.set(g.id, {
      ...g,
      position: { x: groupX, y: groupY },
      style: { ...(g.style ?? {}), width: groupWidth, height: groupHeight },
    });

    for (const n of laidOut) {
      const relativeX = n.position.x - minX + spacing.groupPadding;
      const relativeY = n.position.y - minY + spacing.groupPadding;

      updatedNodes.set(n.id, {
        ...(members.find((m) => m.id === n.id) ?? n),
        position: { x: relativeX, y: relativeY },
        parentNode: g.id,
        extent: 'parent',
      } as any);
    }

    yCursor += groupHeight + spacing.laneGap;
  }

  // Layout ungrouped nodes in their own lane (no container).
  if (ungrouped.length > 0) {
    const ids = new Set(ungrouped.map((u) => u.id));
    const subEdges = edgesFor(ids);
    const laidOut = await doRelayout(
      ungrouped.map((m) => ({ ...m, parentNode: undefined, extent: undefined } as any)),
      subEdges,
      {
        direction: 'LR',
        nodeSpacing: spacing.nodeSpacing,
        rankSpacing: spacing.rankSpacing,
        groupPadding: spacing.groupPadding,
      }
    );

    // Place them below groups.
    const xBase = 80;
    const yBase = yCursor;
    for (const n of laidOut) {
      updatedNodes.set(n.id, {
        ...(ungrouped.find((u) => u.id === n.id) ?? n),
        position: { x: xBase + n.position.x, y: yBase + n.position.y },
        parentNode: undefined,
        extent: undefined,
      } as any);
    }
  }

  // Carry over any other nodes unchanged.
  const finalNodes = nodes.map((n) => updatedNodes.get(n.id) ?? n);
  return { nodes: finalNodes, edges };
}

function applyRadial(
  nodes: Node[],
  edges: Edge[],
  spacing: ReturnType<typeof getSpacing>,
  selectedNodeId?: string
) {
  const serviceNodes = nodes.filter((n) => n.type === 'azureNode');
  if (serviceNodes.length === 0) return { nodes, edges };

  const centerId =
    selectedNodeId && serviceNodes.some((n) => n.id === selectedNodeId)
      ? selectedNodeId
      : pickMostConnectedNode(nodes, edges) ?? serviceNodes[0].id;

  // Undirected adjacency for ring assignment.
  const adj = new Map<string, Set<string>>();
  for (const n of serviceNodes) adj.set(n.id, new Set());
  for (const e of edges) {
    if (!adj.has(e.source) || !adj.has(e.target)) continue;
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }

  // BFS layers.
  const layer = new Map<string, number>();
  const q: string[] = [centerId];
  layer.set(centerId, 0);

  while (q.length) {
    const cur = q.shift()!;
    const d = layer.get(cur)!;
    for (const nb of adj.get(cur) ?? []) {
      if (layer.has(nb)) continue;
      layer.set(nb, d + 1);
      q.push(nb);
    }
  }

  // Any disconnected nodes go to outermost ring.
  const maxLayer = Math.max(...[...layer.values()], 0);
  for (const n of serviceNodes) {
    if (!layer.has(n.id)) layer.set(n.id, maxLayer + 1);
  }

  const rings = new Map<number, string[]>();
  for (const [id, d] of layer.entries()) {
    rings.set(d, [...(rings.get(d) ?? []), id]);
  }

  const center = { x: 520, y: 360 };

  const updatedNodes = nodes.map((n) => {
    if (n.type !== 'azureNode') return n;
    if (n.id === centerId) {
      return { ...n, parentNode: undefined, extent: undefined, position: { x: center.x, y: center.y } } as any;
    }

    const d = layer.get(n.id) ?? 1;
    const ids = rings.get(d) ?? [];
    const idx = ids.indexOf(n.id);

    const radius = spacing.radialBaseRadius + (d - 1) * spacing.radialRingStep;
    const angle = (idx / Math.max(1, ids.length)) * Math.PI * 2;

    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);

    return { ...n, parentNode: undefined, extent: undefined, position: { x, y } } as any;
  });

  // Keep group nodes where they are (radial focuses on services).
  return { nodes: updatedNodes, edges };
}

/**
 * Unified relayout function type — works for both sync (Dagre) and async (ELK).
 */
type RelayoutFn = (nodes: any[], edges: any[], options?: any) => any[] | Promise<any[]>;

function getRelayoutFn(engine: LayoutEngineType = 'dagre'): RelayoutFn {
  return engine === 'elk' ? elkRelayoutDiagram : relayoutDiagram;
}

export async function applyLayoutPreset(nodes: Node[], edges: Edge[], opts: ApplyLayoutOptions): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const spacing = getSpacing(opts.spacing);
  const doRelayout = getRelayoutFn(opts.layoutEngine);

  // Always apply edge path style.
  const styledEdges = withEdgeStyle(edges, opts.edgeStyle);

  if (opts.preset === 'flow-lr') {
    const laidOutNodes = await doRelayout(nodes, styledEdges, {
      direction: 'LR',
      nodeSpacing: spacing.nodeSpacing,
      rankSpacing: spacing.rankSpacing,
      groupPadding: spacing.groupPadding,
    });

    if (opts.emphasizePrimaryPath) {
      return straightenPrimaryPath(laidOutNodes, styledEdges, 'LR');
    }

    return { nodes: laidOutNodes, edges: styledEdges };
  }

  if (opts.preset === 'flow-tb') {
    const laidOutNodes = await doRelayout(nodes, styledEdges, {
      direction: 'TB',
      nodeSpacing: spacing.nodeSpacing,
      rankSpacing: spacing.rankSpacing,
      groupPadding: spacing.groupPadding,
    });

    if (opts.emphasizePrimaryPath) {
      return straightenPrimaryPath(laidOutNodes, styledEdges, 'TB');
    }

    return { nodes: laidOutNodes, edges: styledEdges };
  }

  if (opts.preset === 'swimlanes') {
    const result = await applySwimlanesByGroup(nodes, styledEdges, spacing, doRelayout);
    return result;
  }

  // radial
  return applyRadial(nodes, styledEdges, spacing, opts.selectedNodeId);
}
