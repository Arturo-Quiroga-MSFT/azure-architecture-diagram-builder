// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

interface Point {
  x: number;
  y: number;
}

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 120;
const NEW_NODE_GAP = 80;
const GROUP_PADDING = 48;

export interface LayoutNode {
  id: string;
  type?: string;
  position: Point;
  parentNode?: string;
  data?: unknown;
  style?: unknown;
  width?: number | null;
  height?: number | null;
  selected?: boolean;
}

function normalizeLabel(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function nodeLabel(node: LayoutNode): string {
  const data = node.data as { label?: unknown } | undefined;
  return normalizeLabel(data?.label);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function numericValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function nodeSize(node: LayoutNode): { width: number; height: number } {
  const style = objectValue(node.style);
  return {
    width: numericValue(style.width) ?? node.width ?? DEFAULT_NODE_WIDTH,
    height: numericValue(style.height) ?? node.height ?? DEFAULT_NODE_HEIGHT,
  };
}

function overlaps(left: LayoutNode, right: LayoutNode): boolean {
  if (left.parentNode !== right.parentNode) return false;
  const leftSize = nodeSize(left);
  const rightSize = nodeSize(right);
  return left.position.x < right.position.x + rightSize.width + NEW_NODE_GAP
    && left.position.x + leftSize.width + NEW_NODE_GAP > right.position.x
    && left.position.y < right.position.y + rightSize.height + NEW_NODE_GAP
    && left.position.y + leftSize.height + NEW_NODE_GAP > right.position.y;
}

function absolutePosition(
  node: LayoutNode,
  nodesById: Map<string, LayoutNode>,
  visiting = new Set<string>(),
): Point {
  if (!node.parentNode || visiting.has(node.id)) return node.position;

  const parent = nodesById.get(node.parentNode);
  if (!parent) return node.position;

  visiting.add(node.id);
  const parentPosition = absolutePosition(parent, nodesById, visiting);
  visiting.delete(node.id);
  return {
    x: parentPosition.x + node.position.x,
    y: parentPosition.y + node.position.y,
  };
}

function findMatch(
  generated: LayoutNode,
  candidates: LayoutNode[],
  consumed: Set<string>,
): LayoutNode | undefined {
  const byId = candidates.find((candidate) => candidate.id === generated.id && !consumed.has(candidate.id));
  if (byId) return byId;

  const label = nodeLabel(generated);
  if (!label) return undefined;
  return candidates.find((candidate) => nodeLabel(candidate) === label && !consumed.has(candidate.id));
}

/**
 * Keep the editor-owned geometry of existing nodes while accepting a newly
 * generated topology. Matching is stable-ID first and normalized-label second,
 * because AI refinements can regenerate IDs for otherwise unchanged services.
 * New nodes retain their generated layout.
 */
export function preserveManualLayout<T extends LayoutNode>(
  previousNodes: T[],
  generatedNodes: T[],
): T[] {
  if (previousNodes.length === 0 || generatedNodes.length === 0) return generatedNodes;

  const previousById = new Map(previousNodes.map((node) => [node.id, node]));
  const generatedGroups = generatedNodes.filter((node) => node.type === 'groupNode');
  const previousGroups = previousNodes.filter((node) => node.type === 'groupNode');
  const previousServices = previousNodes.filter((node) => node.type !== 'groupNode');
  const consumed = new Set<string>();
  const matchedGeneratedIds = new Set<string>();
  const preservedGroups = new Map<string, T>();

  for (const generated of generatedGroups) {
    const previous = findMatch(generated, previousGroups, consumed) as T | undefined;
    if (!previous) {
      preservedGroups.set(generated.id, generated as T);
      continue;
    }

    consumed.add(previous.id);
  matchedGeneratedIds.add(generated.id);
    preservedGroups.set(generated.id, {
      ...generated,
      position: { ...previous.position },
      style: { ...objectValue(generated.style), ...objectValue(previous.style) },
      width: previous.width ?? generated.width,
      height: previous.height ?? generated.height,
      selected: previous.selected,
    } as T);
  }

  const generatedGroupMap = new Map(preservedGroups);
  const merged = generatedNodes.map((generated) => {
    if (generated.type === 'groupNode') return preservedGroups.get(generated.id) ?? generated;

    const previous = findMatch(generated, previousServices, consumed) as T | undefined;
    if (!previous) return generated;

    consumed.add(previous.id);
  matchedGeneratedIds.add(generated.id);
    const previousAbsolute = absolutePosition(previous, previousById);
    const generatedParent = generated.parentNode ? generatedGroupMap.get(generated.parentNode) : undefined;
    const generatedParentAbsolute = generatedParent
      ? absolutePosition(generatedParent, generatedGroupMap)
      : { x: 0, y: 0 };

    return {
      ...generated,
      position: {
        x: previousAbsolute.x - generatedParentAbsolute.x,
        y: previousAbsolute.y - generatedParentAbsolute.y,
      },
      data: { ...objectValue(previous.data), ...objectValue(generated.data) },
      style: { ...objectValue(generated.style), ...objectValue(previous.style) },
      width: previous.width ?? generated.width,
      height: previous.height ?? generated.height,
      selected: previous.selected,
    } as T;
  });

  const placedServices = merged.filter(
    (node) => node.type !== 'groupNode' && matchedGeneratedIds.has(node.id),
  );
  const collisionAdjusted = merged.map((node) => {
    if (node.type === 'groupNode' || matchedGeneratedIds.has(node.id)) {
      return node;
    }

    let adjusted = node;
    let blocker = placedServices.find((placed) => overlaps(adjusted, placed));
    while (blocker) {
      const blockerSize = nodeSize(blocker);
      adjusted = {
        ...adjusted,
        position: {
          x: blocker.position.x + blockerSize.width + NEW_NODE_GAP,
          y: adjusted.position.y,
        },
      } as T;
      blocker = placedServices.find((placed) => overlaps(adjusted, placed));
    }
    placedServices.push(adjusted);
    return adjusted;
  });

  return collisionAdjusted.map((node) => {
    if (node.type !== 'groupNode') return node;
    const children = collisionAdjusted.filter((candidate) => candidate.parentNode === node.id);
    if (children.length === 0) return node;

    const requiredWidth = Math.max(...children.map((child) => child.position.x + nodeSize(child).width)) + GROUP_PADDING;
    const requiredHeight = Math.max(...children.map((child) => child.position.y + nodeSize(child).height)) + GROUP_PADDING;
    const currentSize = nodeSize(node);
    const width = Math.max(currentSize.width, requiredWidth);
    const height = Math.max(currentSize.height, requiredHeight);
    if (width === currentSize.width && height === currentSize.height) return node;

    return {
      ...node,
      style: { ...objectValue(node.style), width, height },
      width: node.width == null ? node.width : width,
      height: node.height == null ? node.height : height,
    } as T;
  });
}