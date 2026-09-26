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
// Top inset keeps children clear of the group's label row (and note row).
const GROUP_HEADER_INSET = 72;
const GROUP_GAP = 40;
const MAX_OVERLAP_PASSES = 20;

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
  // generated group ID → the previous group it continues
  const previousGroupFor = new Map<string, string>();

  for (const generated of generatedGroups) {
    const previous = findMatch(generated, previousGroups, consumed) as T | undefined;
    if (!previous) {
      preservedGroups.set(generated.id, generated as T);
      continue;
    }

    consumed.add(previous.id);
    matchedGeneratedIds.add(generated.id);
    previousGroupFor.set(generated.id, previous.id);
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

    // A manual position is only meaningful inside the group it was made in.
    // When the refinement re-homes the service (e.g. Key Vault moving into a
    // new "Security" group), keep its editor data but take the generated
    // position inside the new group; reusing the old canvas spot strands the
    // icon outside its new parent.
    const staysInSameGroup = generated.parentNode
      ? previousGroupFor.get(generated.parentNode) === previous.parentNode
      : !previous.parentNode;
    if (!staysInSameGroup) {
      return {
        ...generated,
        data: { ...objectValue(previous.data), ...objectValue(generated.data) },
        style: { ...objectValue(generated.style), ...objectValue(previous.style) },
        selected: previous.selected,
      } as T;
    }

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

  const contained = containChildren(collisionAdjusted);
  const anchoredGroupIds = new Set(previousGroupFor.keys());
  return separateGroups(contained, anchoredGroupIds);
}

function withSize<T extends LayoutNode>(node: T, width: number, height: number): T {
  return {
    ...node,
    style: { ...objectValue(node.style), width, height },
    width: node.width == null ? node.width : width,
    height: node.height == null ? node.height : height,
  } as T;
}

/**
 * Grow each group on every side so all of its children sit inside it. When a
 * child pokes out left or above, the group moves out and the children shift by
 * the same amount, so nothing moves on screen.
 */
function containChildren<T extends LayoutNode>(nodes: T[]): T[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));

  for (const group of nodes) {
    if (group.type !== 'groupNode') continue;
    const children = nodes.filter((candidate) => candidate.parentNode === group.id);
    if (children.length === 0) continue;

    const minX = Math.min(...children.map((child) => child.position.x));
    const minY = Math.min(...children.map((child) => child.position.y));
    // Only react to children that are actually outside; children the user
    // placed close to the edge are left exactly where they are.
    const shiftX = minX < 0 ? GROUP_PADDING - minX : 0;
    const shiftY = minY < 0 ? GROUP_HEADER_INSET - minY : 0;

    let current = byId.get(group.id)!;
    if (shiftX || shiftY) {
      current = {
        ...current,
        position: { x: current.position.x - shiftX, y: current.position.y - shiftY },
      } as T;
      for (const child of children) {
        byId.set(child.id, {
          ...byId.get(child.id)!,
          position: { x: child.position.x + shiftX, y: child.position.y + shiftY },
        } as T);
      }
    }

    const shifted = children.map((child) => byId.get(child.id)!);
    const requiredWidth = Math.max(...shifted.map((child) => child.position.x + nodeSize(child).width)) + GROUP_PADDING;
    const requiredHeight = Math.max(...shifted.map((child) => child.position.y + nodeSize(child).height)) + GROUP_PADDING;
    const size = nodeSize(current);
    const width = Math.max(size.width + shiftX, requiredWidth);
    const height = Math.max(size.height + shiftY, requiredHeight);
    byId.set(group.id, (width === size.width && height === size.height) ? current : withSize(current, width, height));
  }

  return nodes.map((node) => byId.get(node.id)!);
}

/**
 * Push overlapping top-level groups apart. Groups that continue a previous
 * group are anchored to the user's layout; newly added groups move out of
 * their way. Children are relative to their group, so they move with it.
 */
function separateGroups<T extends LayoutNode>(nodes: T[], anchored: Set<string>): T[] {
  const groups = nodes
    .filter((node) => node.type === 'groupNode' && !node.parentNode)
    .map((node) => ({ id: node.id, x: node.position.x, y: node.position.y, ...nodeSize(node), anchored: anchored.has(node.id) }));
  if (groups.length < 2) return nodes;

  for (let pass = 0; pass < MAX_OVERLAP_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i];
        const b = groups[j];
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;

        // Move only the unanchored group when exactly one is anchored;
        // otherwise split the push between both.
        const shareA = a.anchored === b.anchored ? 0.5 : (a.anchored ? 0 : 1);
        const shareB = 1 - shareA;
        if (overlapX < overlapY) {
          const push = overlapX + GROUP_GAP;
          const direction = a.x + a.width / 2 <= b.x + b.width / 2 ? 1 : -1;
          a.x -= direction * push * shareA;
          b.x += direction * push * shareB;
        } else {
          const push = overlapY + GROUP_GAP;
          const direction = a.y + a.height / 2 <= b.y + b.height / 2 ? 1 : -1;
          a.y -= direction * push * shareA;
          b.y += direction * push * shareB;
        }
      }
    }
    if (!moved) break;
  }

  // A new group wedged between two anchored ones can bounce between them
  // without settling. Move any unanchored group that still collides just past
  // the right edge of everything else, keeping its row.
  const collides = (g: typeof groups[number]) => groups.some((other) => other !== g
    && g.x < other.x + other.width && g.x + g.width > other.x
    && g.y < other.y + other.height && g.y + g.height > other.y);
  for (const group of groups) {
    if (group.anchored || !collides(group)) continue;
    const rightEdge = Math.max(...groups.filter((other) => other !== group).map((other) => other.x + other.width));
    group.x = rightEdge + GROUP_GAP;
  }

  const positions = new Map(groups.map((group) => [group.id, { x: group.x, y: group.y }]));
  return nodes.map((node) => {
    const position = positions.get(node.id);
    if (!position || (position.x === node.position.x && position.y === node.position.y)) return node;
    return { ...node, position } as T;
  });
}