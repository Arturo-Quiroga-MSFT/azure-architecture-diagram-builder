import {
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
  type Edge,
  type Node,
} from 'reactflow';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 136;
const LABEL_GAP = 10;
const MIN_MIDPOINT_TRUNK = 80;
// Covering an icon destroys more meaning than clipping a neighbouring label, so
// a node collision outweighs any amount of label overlap or drift.
const NODE_OVERLAP_PENALTY = 1000;
// A label pushed far from its edge reads as unattached, so distance is scored
// against overlap area rather than treated as free. Sliding along the run keeps
// the label on its own line, so it costs far less than stepping off it.
const ALONG_DRIFT_PENALTY = 10;
const ACROSS_DRIFT_PENALTY = 60;
// Edges between the same two nodes resolve to the same handles, so a request
// and its response render as one line carrying two labels.
function parallelPathOffsets(edges: Edge[]): Map<string, number> {
  const shared = new Map<string, Edge[]>();
  edges.forEach(edge => {
    const key = [edge.source, edge.target].sort().join('\u0000');
    const group = shared.get(key);
    if (group) group.push(edge); else shared.set(key, [edge]);
  });

  const offsets = new Map<string, number>();
  shared.forEach(group => {
    if (group.length < 2) {
      group.forEach(edge => offsets.set(edge.id, 0));
      return;
    }
    // Spacing the lines by the tallest chip lets every label stay on its own
    // line; a fixed gap forces them off it to avoid each other.
    const gap = Math.max(...group.map(edge => labelSize(edge.label).height)) + LABEL_GAP;
    group.forEach((edge, index) => {
      offsets.set(edge.id, (index - (group.length - 1) / 2) * gap);
    });
  });
  return offsets;
}

function nodeSize(node: Node): { width: number; height: number } {
  return {
    width: Number(node.width ?? node.style?.width ?? NODE_WIDTH),
    height: Number(node.height ?? node.style?.height ?? NODE_HEIGHT),
  };
}

function absoluteNodeRects(nodes: Node[]): Map<string, Rect> {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const result = new Map<string, Rect>();

  nodes.filter(node => node.type === 'azureNode').forEach(node => {
    const parent = node.parentNode ? byId.get(node.parentNode) : undefined;
    const size = nodeSize(node);
    result.set(node.id, {
      x: node.position.x + (parent?.position.x ?? 0),
      y: node.position.y + (parent?.position.y ?? 0),
      width: size.width,
      height: size.height,
    });
  });

  return result;
}

// Measured from the rendered chip: max-width 180, padding 4px 8px, 2px border,
// bold 14px system font at an 18.2px line box, clamped to three lines.
const LABEL_MAX_WIDTH = 180;
const LABEL_CONTENT_WIDTH = 160;
const LABEL_LINE_HEIGHT = 18.2;
const LABEL_CHROME = 12;
const LABEL_MAX_LINES = 3;
const LABEL_CHAR_WIDTH = 8.2;

function labelSize(label: unknown): { width: number; height: number } {
  const text = String(label ?? '').trim();
  if (!text) return { width: 0, height: 0 };
  const ideal = text.length * LABEL_CHAR_WIDTH;
  const width = Math.min(LABEL_MAX_WIDTH, Math.max(80, ideal + 20));
  // Word wrapping breaks a line before it is full, so a width-only estimate
  // under-counts lines: two 39-character labels measured 2 and 3 lines. Round
  // wrapped labels up a line rather than reserve a corridor that is too short.
  const packed = Math.ceil(ideal / LABEL_CONTENT_WIDTH);
  const lines = Math.min(LABEL_MAX_LINES, packed + (ideal > LABEL_CONTENT_WIDTH ? 1 : 0));
  return { width, height: lines * LABEL_LINE_HEIGHT + LABEL_CHROME };
}

// Congested diagrams can leave a label with no clear slot at all. Scoring the
// overlap lets the pass pick the least-bad slot instead of falling back to the
// first candidate, which is the one already known to collide.
function overlapArea(left: Rect, right: Rect, gap = 0): number {
  const x = left.x - gap;
  const y = left.y - gap;
  const width = Math.min(x + left.width + gap * 2, right.x + right.width) - Math.max(x, right.x);
  const height = Math.min(y + left.height + gap * 2, right.y + right.height) - Math.max(y, right.y);
  return width > 0 && height > 0 ? width * height : 0;
}

function handlePoint(rect: Rect, handleId: string | null | undefined) {
  const side = handleId?.includes('left')
    ? Position.Left
    : handleId?.includes('top')
      ? Position.Top
      : handleId?.includes('bottom')
        ? Position.Bottom
        : Position.Right;

  if (side === Position.Left) return { x: rect.x, y: rect.y + rect.height / 2, side };
  if (side === Position.Top) return { x: rect.x + rect.width / 2, y: rect.y, side };
  if (side === Position.Bottom) return { x: rect.x + rect.width / 2, y: rect.y + rect.height, side };
  return { x: rect.x + rect.width, y: rect.y + rect.height / 2, side };
}

function labelAnchor(edge: Edge, source: Rect, target: Rect, pathOffset = 0): { x: number; y: number } {
  const sourcePoint = handlePoint(source, edge.sourceHandle);
  const targetPoint = handlePoint(target, edge.targetHandle);
  const pathStyle = (edge.data as any)?.pathStyle;
  const pathFunction = pathStyle === 'straight'
    ? getStraightPath
    : pathStyle === 'orthogonal'
      ? getSmoothStepPath
      : getBezierPath;
  const horizontal = sourcePoint.side === Position.Left || sourcePoint.side === Position.Right;
  const [, x, y] = pathFunction({
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    sourcePosition: sourcePoint.side,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
    targetPosition: targetPoint.side,
    ...(pathOffset && horizontal
      ? { centerY: (sourcePoint.y + targetPoint.y) / 2 + pathOffset }
      : {}),
    ...(pathOffset && !horizontal
      ? { centerX: (sourcePoint.x + targetPoint.x) / 2 + pathOffset }
      : {}),
  } as any);
  return { x, y };
}

function geometryHandles(source: Rect, target: Rect): { sourceHandle: string; targetHandle: string } {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'right', targetHandle: 'left' }
      : { sourceHandle: 'left-source', targetHandle: 'right-target' };
  }
  return dy >= 0
    ? { sourceHandle: 'bottom', targetHandle: 'top' }
    : { sourceHandle: 'top-source', targetHandle: 'bottom-target' };
}

function offsetCandidates(edge: Edge, source: Rect, target: Rect, pathOffset: number): Array<{ x: number; y: number; along: number; across: number }> {
  const sourcePoint = handlePoint(source, edge.sourceHandle);
  const targetPoint = handlePoint(target, edge.targetHandle);
  const pathStyle = (edge.data as any)?.pathStyle;
  const sourceIsHorizontal = sourcePoint.side === Position.Left || sourcePoint.side === Position.Right;
  const horizontalTrunk = pathStyle === 'orthogonal'
    ? sourceIsHorizontal
      ? Math.abs(sourcePoint.y - targetPoint.y) < MIN_MIDPOINT_TRUNK
      : Math.abs(sourcePoint.x - targetPoint.x) >= MIN_MIDPOINT_TRUNK
    : Math.abs(sourcePoint.x - targetPoint.x) >= Math.abs(sourcePoint.y - targetPoint.y);
  // Sliding along the run keeps a label on its own line, so it gets a far wider
  // range than stepping sideways -- but only as far as the run actually
  // extends, or the label slides off the end and floats again.
  const runLength = horizontalTrunk
    ? Math.abs(sourcePoint.x - targetPoint.x)
    : Math.abs(sourcePoint.y - targetPoint.y);
  const alongLimit = Math.max(0, runLength / 2 - LABEL_GAP * 2);
  const along = [0, -60, 60, -120, 120, -180, 180, -240, 240, -300, 300]
    .filter(step => Math.abs(step) <= alongLimit);
  const across = pathOffset === 0 ? [0, -45, 45, -90, 90] : [0, -30, 30];
  return horizontalTrunk
    ? across.flatMap(y => along.map(x => ({ x, y, along: Math.abs(x), across: Math.abs(y) })))
    : across.flatMap(x => along.map(y => ({ x, y, along: Math.abs(y), across: Math.abs(x) })));
}

export function deconflictEdgeLabels(nodes: Node[], edges: Edge[]): Edge[] {
  const nodeRects = absoluteNodeRects(nodes);
  const pathOffsets = parallelPathOffsets(edges);
  const placedLabels: Rect[] = [];

  return edges.map(edge => {
    const source = nodeRects.get(edge.source);
    const target = nodeRects.get(edge.target);
    if (!source || !target || !edge.label) return edge;

    const handles = geometryHandles(source, target);
    const pathOffset = pathOffsets.get(edge.id) ?? 0;
    const routedEdge = { ...edge, ...handles };
    const anchor = labelAnchor(routedEdge, source, target, pathOffset);
    const size = labelSize(edge.label);
    const existingX = Number((edge.data as any)?.labelOffsetX ?? 0);
    const existingY = Number((edge.data as any)?.labelOffsetY ?? 0);
    const hasManualOffset = (existingX !== 0 || existingY !== 0)
      && (edge.data as any)?.labelOffsetSource !== 'auto';
    const candidates = hasManualOffset
      ? [{ x: existingX, y: existingY, along: 0, across: 0 }]
      : offsetCandidates(routedEdge, source, target, pathOffset);

    let selected = candidates[0];
    let selectedRect: Rect = {
      x: anchor.x + selected.x - size.width / 2,
      y: anchor.y + selected.y - size.height / 2,
      ...size,
    };

    let bestPenalty = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const rect = {
        x: anchor.x + candidate.x - size.width / 2,
        y: anchor.y + candidate.y - size.height / 2,
        ...size,
      };
      let penalty = 0;
      for (const nodeRect of nodeRects.values()) {
        penalty += NODE_OVERLAP_PENALTY * overlapArea(rect, nodeRect, LABEL_GAP);
      }
      for (const labelRect of placedLabels) {
        penalty += overlapArea(rect, labelRect, LABEL_GAP);
      }
      penalty += ALONG_DRIFT_PENALTY * candidate.along + ACROSS_DRIFT_PENALTY * candidate.across;
      if (penalty === 0) {
        selected = candidate;
        selectedRect = rect;
        break;
      }
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        selected = candidate;
        selectedRect = rect;
      }
    }

    placedLabels.push(selectedRect);
    return {
      ...routedEdge,
      data: {
        ...(edge.data ?? {}),
        pathOffset,
        labelOffsetX: selected.x,
        labelOffsetY: selected.y,
        labelOffsetSource: hasManualOffset ? (edge.data as any)?.labelOffsetSource : 'auto',
      },
    };
  });
}