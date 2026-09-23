// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Node } from 'reactflow';

/**
 * Constants shared by GroupNode and App-level group operations.
 */
export const GROUP_PADDING = 40;
export const GROUP_HEADER_HEIGHT = 50;

/**
 * Compute the bounding box of a group's children and return
 * the updated node array with the group tightly fitted and
 * children repositioned relative to the new origin.
 *
 * Returns null if the group has no children (no-op).
 */
export function fitGroupToContent(
  allNodes: Node[],
  groupId: string
): Node[] | null {
  const children = allNodes.filter(n => n.parentNode === groupId);
  if (children.length === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  children.forEach(child => {
    const x = child.position.x;
    const y = child.position.y;
    const w = (child.width as number) || 160;
    const h = (child.height as number) || 100;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });

  const offsetX = minX - GROUP_PADDING;
  const offsetY = minY - GROUP_PADDING - GROUP_HEADER_HEIGHT;
  const newWidth = maxX - minX + GROUP_PADDING * 2;
  const newHeight = maxY - minY + GROUP_PADDING * 2 + GROUP_HEADER_HEIGHT;

  return allNodes.map(n => {
    if (n.id === groupId) {
      return { ...n, style: { ...n.style, width: newWidth, height: newHeight } };
    }
    if (n.parentNode === groupId) {
      return {
        ...n,
        position: { x: n.position.x - offsetX, y: n.position.y - offsetY },
      };
    }
    return n;
  });
}

/**
 * Apply fitGroupToContent to every group node in the array.
 * Returns the modified node array.
 */
export function fitAllGroupsToContent(nodes: Node[]): Node[] {
  const groupIds = nodes
    .filter(n => n.type === 'groupNode')
    .map(n => n.id);

  let result = [...nodes];
  for (const gid of groupIds) {
    const updated = fitGroupToContent(result, gid);
    if (updated) result = updated;
  }
  return result;
}
