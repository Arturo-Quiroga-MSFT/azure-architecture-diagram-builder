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

function labelSize(label: unknown): { width: number; height: number } {
  const text = String(label ?? '').trim();
  const width = Math.min(180, Math.max(80, text.length * 7 + 18));
  const lines = Math.min(3, Math.max(1, Math.ceil((text.length * 7) / Math.max(1, width - 16))));
  return { width, height: lines * 18 + 12 };
}

function intersects(left: Rect, right: Rect, gap = 0): boolean {
  return left.x < right.x + right.width + gap
    && left.x + left.width + gap > right.x
    && left.y < right.y + right.height + gap
    && left.y + left.height + gap > right.y;
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

function labelAnchor(edge: Edge, source: Rect, target: Rect): { x: number; y: number } {
  const sourcePoint = handlePoint(source, edge.sourceHandle);
  const targetPoint = handlePoint(target, edge.targetHandle);
  const pathStyle = (edge.data as any)?.pathStyle;
  const pathFunction = pathStyle === 'straight'
    ? getStraightPath
    : pathStyle === 'orthogonal'
      ? getSmoothStepPath
      : getBezierPath;
  const [, x, y] = pathFunction({
    sourceX: sourcePoint.x,
    sourceY: sourcePoint.y,
    sourcePosition: sourcePoint.side,
    targetX: targetPoint.x,
    targetY: targetPoint.y,
    targetPosition: targetPoint.side,
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

function offsetCandidates(edge: Edge, source: Rect, target: Rect): Array<{ x: number; y: number }> {
  const sourcePoint = handlePoint(source, edge.sourceHandle);
  const targetPoint = handlePoint(target, edge.targetHandle);
  const pathStyle = (edge.data as any)?.pathStyle;
  const sourceIsHorizontal = sourcePoint.side === Position.Left || sourcePoint.side === Position.Right;
  const horizontalTrunk = pathStyle === 'orthogonal'
    ? sourceIsHorizontal
      ? Math.abs(sourcePoint.y - targetPoint.y) < MIN_MIDPOINT_TRUNK
      : Math.abs(sourcePoint.x - targetPoint.x) >= MIN_MIDPOINT_TRUNK
    : Math.abs(sourcePoint.x - targetPoint.x) >= Math.abs(sourcePoint.y - targetPoint.y);
  const along = [0, -60, 60, -120, 120];
  const across = [0, -45, 45, -90, 90];
  return horizontalTrunk
    ? across.flatMap(y => along.map(x => ({ x, y })))
    : across.flatMap(x => along.map(y => ({ x, y })))
      .sort((left, right) => Math.abs(left.x) + Math.abs(left.y) - Math.abs(right.x) - Math.abs(right.y));
}

export function deconflictEdgeLabels(nodes: Node[], edges: Edge[]): Edge[] {
  const nodeRects = absoluteNodeRects(nodes);
  const placedLabels: Rect[] = [];

  return edges.map(edge => {
    const source = nodeRects.get(edge.source);
    const target = nodeRects.get(edge.target);
    if (!source || !target || !edge.label) return edge;

    const handles = geometryHandles(source, target);
    const routedEdge = { ...edge, ...handles };
    const anchor = labelAnchor(routedEdge, source, target);
    const size = labelSize(edge.label);
    const existingX = Number((edge.data as any)?.labelOffsetX ?? 0);
    const existingY = Number((edge.data as any)?.labelOffsetY ?? 0);
    const hasManualOffset = (existingX !== 0 || existingY !== 0)
      && (edge.data as any)?.labelOffsetSource !== 'auto';
    const candidates = hasManualOffset
      ? [{ x: existingX, y: existingY }]
      : offsetCandidates(routedEdge, source, target);

    let selected = candidates[0];
    let selectedRect: Rect = {
      x: anchor.x + selected.x - size.width / 2,
      y: anchor.y + selected.y - size.height / 2,
      ...size,
    };

    for (const candidate of candidates) {
      const rect = {
        x: anchor.x + candidate.x - size.width / 2,
        y: anchor.y + candidate.y - size.height / 2,
        ...size,
      };
      const hitsNode = [...nodeRects.values()].some(nodeRect => intersects(rect, nodeRect, LABEL_GAP));
      const hitsLabel = placedLabels.some(labelRect => intersects(rect, labelRect, LABEL_GAP));
      if (!hitsNode && !hitsLabel) {
        selected = candidate;
        selectedRect = rect;
        break;
      }
    }

    placedLabels.push(selectedRect);
    return {
      ...routedEdge,
      data: {
        ...(edge.data ?? {}),
        labelOffsetX: selected.x,
        labelOffsetY: selected.y,
        labelOffsetSource: hasManualOffset ? (edge.data as any)?.labelOffsetSource : 'auto',
      },
    };
  });
}