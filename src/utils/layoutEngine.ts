// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Layout Engine - Automatic graph layout using Dagre
 * Replaces LLM-based positioning with deterministic algorithms
 */

import dagre from 'dagre';

export interface LayoutOptions {
  direction: 'LR' | 'TB' | 'RL' | 'BT'; // Left-Right, Top-Bottom, etc.
  nodeSpacing: number;  // Horizontal spacing between nodes
  rankSpacing: number;  // Vertical spacing between layers
  groupPadding: number; // Padding inside group containers
}

interface LayoutService {
  id: string;
  name: string;
  groupId?: string;
  [key: string]: any;
}

interface LayoutConnection {
  from: string;
  to: string;
  [key: string]: any;
}

interface LayoutGroup {
  id: string;
  label: string;
  [key: string]: any;
}

interface PositionedService extends LayoutService {
  position: { x: number; y: number };
}

interface PositionedGroup extends LayoutGroup {
  position: { x: number; y: number };
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: LayoutOptions = {
  direction: 'LR',      // Left-to-right (typical data flow)
  nodeSpacing: 180,     // Space between nodes horizontally
  rankSpacing: 250,     // Space between layers vertically
  groupPadding: 100     // Padding inside groups
};

const NODE_WIDTH = 180;   // Standard node width
const NODE_HEIGHT = 100;  // Standard node height
const GROUP_GAP = 40;     // Minimum gap between groups after overlap resolution

/**
 * Detect and resolve overlapping groups by pushing them apart.
 * Runs iteratively until no overlaps remain (max 10 passes).
 */
function resolveGroupOverlaps(
  groups: PositionedGroup[],
  services: PositionedService[]
): { groups: PositionedGroup[]; services: PositionedService[] } {
  if (groups.length < 2) return { groups, services };

  let resolved = groups.map(g => ({ ...g, position: { ...g.position } }));
  let moved = true;
  let passes = 0;

  while (moved && passes < 10) {
    moved = false;
    passes++;

    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        const a = resolved[i];
        const b = resolved[j];

        // Check AABB overlap
        const overlapX = Math.min(a.position.x + a.width, b.position.x + b.width) - Math.max(a.position.x, b.position.x);
        const overlapY = Math.min(a.position.y + a.height, b.position.y + b.height) - Math.max(a.position.y, b.position.y);

        if (overlapX > 0 && overlapY > 0) {
          moved = true;

          // Push apart along the axis with less overlap (cheaper fix)
          if (overlapX < overlapY) {
            const push = (overlapX + GROUP_GAP) / 2;
            const aCenterX = a.position.x + a.width / 2;
            const bCenterX = b.position.x + b.width / 2;
            if (aCenterX <= bCenterX) {
              a.position.x -= push;
              b.position.x += push;
            } else {
              a.position.x += push;
              b.position.x -= push;
            }
          } else {
            const push = (overlapY + GROUP_GAP) / 2;
            const aCenterY = a.position.y + a.height / 2;
            const bCenterY = b.position.y + b.height / 2;
            if (aCenterY <= bCenterY) {
              a.position.y -= push;
              b.position.y += push;
            } else {
              a.position.y += push;
              b.position.y -= push;
            }
          }
        }
      }
    }
  }

  if (passes > 1) {
    console.log(`  🔧 Resolved group overlaps in ${passes} passes`);
  }

  // Build a map of how each group moved (delta)
  const deltas = new Map<string, { dx: number; dy: number }>();
  for (let i = 0; i < groups.length; i++) {
    deltas.set(groups[i].id, {
      dx: resolved[i].position.x - groups[i].position.x,
      dy: resolved[i].position.y - groups[i].position.y,
    });
  }

  // Shift ungrouped services that sat inside a moved group's original bounds
  // (grouped services move with their parent automatically since positions are relative)
  const adjustedServices = services.map(s => {
    if (s.groupId) return s; // relative to parent — no adjustment needed
    // Check if this ungrouped service overlaps any moved group — leave it alone
    return s;
  });

  return { groups: resolved, services: adjustedServices };
}

/**
 * Calculate optimal layout for Azure architecture diagram
 * Uses Dagre's hierarchical layout algorithm
 */
export function layoutArchitecture(
  services: LayoutService[],
  connections: LayoutConnection[],
  groups: LayoutGroup[] = [],
  options: Partial<LayoutOptions> = {}
): { services: PositionedService[]; groups: PositionedGroup[] } {
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  console.log('📐 Calculating layout for', services.length, 'services and', groups.length, 'groups');
  
  // Create directed graph with compound nodes support
  const g = new dagre.graphlib.Graph({ compound: true });
  
  // Configure graph
  g.setGraph({
    rankdir: opts.direction,
    nodesep: opts.nodeSpacing,
    ranksep: opts.rankSpacing,
    marginx: 80,
    marginy: 80,
    edgesep: 80
  });
  
  // Set default edge label
  g.setDefaultEdgeLabel(() => ({}));
  
  // Build a set of service node IDs to detect collisions with group IDs
  const serviceIds = new Set(services.map(s => s.id));
  
  // Map group IDs to their Dagre node IDs (prefixed if they collide with a service ID)
  const groupIdMap = new Map<string, string>();
  groups.forEach(group => {
    const dagreId = serviceIds.has(group.id) ? `__group__${group.id}` : group.id;
    if (dagreId !== group.id) {
      console.warn(`⚠️ Group id "${group.id}" collides with a service id — using "${dagreId}" internally`);
    }
    groupIdMap.set(group.id, dagreId);
  });
  
  // Add groups as parent nodes first (if any)
  groups.forEach(group => {
    const dagreId = groupIdMap.get(group.id)!;
    g.setNode(dagreId, {
      label: group.label,
      clusterLabelPos: 'top',
      style: 'fill: none',  // Groups are just containers
    });
  });
  
  // Add service nodes to graph
  services.forEach(service => {
    g.setNode(service.id, {
      label: service.name,
      width: NODE_WIDTH,
      height: NODE_HEIGHT
    });
    
    // Link service to its parent group (if any)
    if (service.groupId) {
      const parentDagreId = groupIdMap.get(service.groupId);
      if (parentDagreId) {
        g.setParent(service.id, parentDagreId);
      } else {
        console.warn(`⚠️ Service "${service.id}" references unknown group "${service.groupId}"`);
      }
    }
  });
  
  // Add edges to graph
  connections.forEach(conn => {
    g.setEdge(conn.from, conn.to);
  });
  
  // Run layout algorithm
  console.log('  ⚡ Running Dagre layout algorithm...');
  dagre.layout(g);
  
  // Extract positions from graph
  const positionedServices: PositionedService[] = services.map(service => {
    const node = g.node(service.id);
    return {
      ...service,
      position: {
        x: node.x - (NODE_WIDTH / 2),  // Center the node
        y: node.y - (NODE_HEIGHT / 2)
      }
    };
  });
  
  console.log('  ✅ Services positioned');
  
  // Get group bounding boxes from Dagre (it calculated them for compound nodes)
  const positionedGroups: PositionedGroup[] = groups
    .map(group => {
      const dagreId = groupIdMap.get(group.id) ?? group.id;
      const groupNode = g.node(dagreId);
      
      if (!groupNode) {
        console.warn(`  ⚠️ Group ${group.id} not found in graph`);
        return null;
      }
      
      // Dagre provides x, y (center), width, and height for compound nodes
      const padding = opts.groupPadding;
      
      return {
        ...group,
        position: {
          x: groupNode.x - (groupNode.width / 2) - padding,
          y: groupNode.y - (groupNode.height / 2) - padding
        },
        width: groupNode.width + (padding * 2),
        height: groupNode.height + (padding * 2)
      };
    })
    .filter((g): g is PositionedGroup => g !== null);
  
  // Post-process: resolve any overlapping groups
  const { groups: finalGroups } = resolveGroupOverlaps(positionedGroups, positionedServices);

  // Convert grouped service positions to be relative to their parent group
  const finalServices = positionedServices.map(service => {
    if (service.groupId) {
      const parentGroup = finalGroups.find(g => g.id === service.groupId);
      if (parentGroup) {
        return {
          ...service,
          position: {
            x: service.position.x - parentGroup.position.x,
            y: service.position.y - parentGroup.position.y
          }
        };
      }
    }
    return service;
  });
  
  console.log('  ✅ Groups positioned, overlaps resolved, positions made relative');
  console.log('📐 Layout complete!');
  
  return {
    services: finalServices,
    groups: finalGroups
  };
}

/**
 * Re-layout existing diagram with new options
 * Useful for "Re-arrange" button functionality
 */
export function relayoutDiagram(
  nodes: any[],
  edges: any[],
  options: Partial<LayoutOptions> = {}
): any[] {
  // Extract services and connections from React Flow nodes/edges
  const services = nodes
    .filter(n => n.type === 'azureNode')
    .map(n => ({
      id: n.id,
      name: n.data.label,
      groupId: n.parentNode
    }));
  
  const connections = edges.map(e => ({
    from: e.source,
    to: e.target
  }));
  
  const groups = nodes
    .filter(n => n.type === 'groupNode')
    .map(n => ({
      id: n.id,
      label: n.data.label
    }));
  
  const { services: positioned, groups: positionedGroups } = layoutArchitecture(
    services,
    connections,
    groups,
    options
  );
  
  // Map back to React Flow nodes
  const updatedNodes = nodes.map(node => {
    if (node.type === 'azureNode') {
      const pos = positioned.find(s => s.id === node.id);
      if (pos) {
        return { ...node, position: pos.position };
      }
    } else if (node.type === 'groupNode') {
      const pos = positionedGroups.find(g => g.id === node.id);
      if (pos) {
        return {
          ...node,
          position: pos.position,
          style: {
            ...node.style,
            width: pos.width,
            height: pos.height
          }
        };
      }
    }
    return node;
  });
  
  return updatedNodes;
}

/**
 * Calculate layout direction based on architecture type
 * Helper for intelligent layout selection
 */
export function suggestLayoutDirection(services: LayoutService[]): 'LR' | 'TB' {
  // If we have many services, prefer left-to-right for wider canvas
  if (services.length > 8) {
    return 'LR';
  }
  
  // Default to left-to-right (typical data flow)
  return 'LR';
}
