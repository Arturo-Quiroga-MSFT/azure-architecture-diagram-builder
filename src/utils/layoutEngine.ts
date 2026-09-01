// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Layout Engine - Automatic graph layout using Dagre
 * Replaces LLM-based positioning with deterministic algorithms
 */

import dagre from '@dagrejs/dagre';

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
  direction: 'LR',
  nodeSpacing: 220,
  rankSpacing: 280,
  groupPadding: 80
};

const NODE_WIDTH = 180;   // Standard node width
// Rendered nodes measure 111-134px tall across captured diagrams; the old 100
// under-reserved every vertical gap and every group height.
const NODE_HEIGHT = 136;
const GROUP_GAP = 40;     // Minimum gap between groups after overlap resolution
const GROUP_HEADER_HEIGHT = 64; // label row + optional note row (e.g. Private Connectivity)

// Dagre only reserves rank space for an edge when that edge declares a label
// box, so labelled connections get a corridor instead of sharing the node gap.
const EDGE_LABEL_WIDTH = 190;
const EDGE_LABEL_HEIGHT = 70;

function edgeLabelBox(connection: LayoutConnection): Record<string, unknown> {
  return String(connection.label ?? '').trim()
    ? { width: EDGE_LABEL_WIDTH, height: EDGE_LABEL_HEIGHT, labelpos: 'c' }
    : {};
}

function isSemanticRelationship(connection: LayoutConnection): boolean {
  return connection.type === 'association' || connection.type === 'containment';
}

function dagreEdgeOptions(connection: LayoutConnection): Record<string, unknown> {
  return isSemanticRelationship(connection)
    ? { ...edgeLabelBox(connection), minlen: 1, weight: 0 }
    : edgeLabelBox(connection);
}

interface GroupSubLayout {
  positions: Map<string, { x: number; y: number }>;
  width: number;
  height: number;
}

function isPrivateEndpointService(service: LayoutService): boolean {
  return /^private endpoint\b/i.test(String(service.name ?? ''));
}

function isAppService(service: LayoutService): boolean {
  return /\bapp service\b/i.test(String(service.name ?? ''));
}

function layoutPrivateEndpointPairs(
  members: LayoutService[],
  connections: LayoutConnection[],
  options: LayoutOptions,
): GroupSubLayout | null {
  const memberById = new Map(members.map(member => [member.id, member]));
  const pairs: Array<{ endpoint: LayoutService; target: LayoutService }> = [];
  const pairedIds = new Set<string>();

  for (const connection of connections) {
    if (connection.type !== 'association') continue;
    const source = memberById.get(connection.from);
    const target = memberById.get(connection.to);
    if (!source || !target) continue;
    const endpoint = isPrivateEndpointService(source)
      ? source
      : isPrivateEndpointService(target)
        ? target
        : null;
    if (!endpoint) continue;
    const protectedResource = endpoint.id === source.id ? target : source;
    if (isAppService(protectedResource)) continue;
    pairs.push({ endpoint, target: protectedResource });
    pairedIds.add(endpoint.id);
    pairedIds.add(protectedResource.id);
  }

  if (pairs.length === 0) return null;

  const pairGap = Math.max(220, EDGE_LABEL_WIDTH + 30);
  const rowGap = Math.max(90, Math.round(options.nodeSpacing * 0.45));
  const pairWidth = NODE_WIDTH * 2 + pairGap;
  const containmentSourceIds = new Set(
    connections
      .filter(connection => (
        connection.type === 'containment'
        && memberById.has(connection.from)
        && pairs.some(pair => pair.endpoint.id === connection.to)
      ))
      .map(connection => connection.from),
  );
  const unpaired = members.filter(member => !pairedIds.has(member.id));
  const headerMembers = [
    ...unpaired.filter(member => containmentSourceIds.has(member.id)),
    ...unpaired.filter(member => !containmentSourceIds.has(member.id)),
  ];
  const positions = new Map<string, { x: number; y: number }>();
  let currentY = 0;

  if (headerMembers.length > 0) {
    const headerGap = Math.max(80, Math.round(options.nodeSpacing * 0.4));
    const headerWidth = headerMembers.length * NODE_WIDTH + Math.max(0, headerMembers.length - 1) * headerGap;
    const headerStartX = Math.max(0, (pairWidth - headerWidth) / 2);
    headerMembers.forEach((member, index) => {
      positions.set(member.id, { x: headerStartX + index * (NODE_WIDTH + headerGap), y: currentY });
    });
    currentY += NODE_HEIGHT + rowGap;
  }

  const memberOrder = new Map(members.map((member, index) => [member.id, index]));
  pairs.sort((left, right) => (
    (memberOrder.get(left.target.id) ?? 0) - (memberOrder.get(right.target.id) ?? 0)
  ));
  pairs.forEach((pair, index) => {
    const y = currentY + index * (NODE_HEIGHT + rowGap);
    positions.set(pair.target.id, { x: 0, y });
    positions.set(pair.endpoint.id, { x: NODE_WIDTH + pairGap, y });
  });

  const pairRowsHeight = pairs.length * NODE_HEIGHT + Math.max(0, pairs.length - 1) * rowGap;
  return {
    positions,
    width: pairWidth,
    height: currentY + pairRowsHeight,
  };
}

function layoutGroupMembers(
  members: LayoutService[],
  connections: LayoutConnection[],
  direction: LayoutOptions['direction'],
  options: LayoutOptions
): GroupSubLayout {
  const memberIds = new Set(members.map(member => member.id));
  const privateEndpointLayout = layoutPrivateEndpointPairs(members, connections, options);
  if (privateEndpointLayout) return privateEndpointLayout;
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: direction,
    nodesep: Math.max(90, Math.round(options.nodeSpacing * 0.45)),
    ranksep: Math.max(180, Math.round(options.rankSpacing * 0.75)),
    marginx: 0,
    marginy: 0,
    ranker: 'network-simplex',
  });
  graph.setDefaultEdgeLabel(() => ({}));

  members.forEach(member => graph.setNode(member.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  connections.forEach(connection => {
    if (!isSemanticRelationship(connection) && connection.from !== connection.to && memberIds.has(connection.from) && memberIds.has(connection.to)) {
      graph.setEdge(connection.from, connection.to, dagreEdgeOptions(connection));
    }
  });
  dagre.layout(graph);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const absolutePositions = new Map<string, { x: number; y: number }>();

  members.forEach(member => {
    const node = graph.node(member.id);
    const x = node.x - NODE_WIDTH / 2;
    const y = node.y - NODE_HEIGHT / 2;
    absolutePositions.set(member.id, { x, y });
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + NODE_WIDTH);
    maxY = Math.max(maxY, y + NODE_HEIGHT);
  });

  const positions = new Map<string, { x: number; y: number }>();
  absolutePositions.forEach((position, id) => {
    positions.set(id, { x: position.x - minX, y: position.y - minY });
  });

  return { positions, width: maxX - minX, height: maxY - minY };
}

// Dagre centres every node of a rank on one axis line, so a narrow group beside
// a wide one starts hundreds of pixels further along and the column reads ragged.
function alignGroupsWithinRanks(
  groups: Array<PositionedGroup & { rankCentre: number }>,
  direction: LayoutOptions['direction']
): PositionedGroup[] {
  const vertical = direction === 'TB' || direction === 'BT';
  const ranks = new Map<number, Array<PositionedGroup & { rankCentre: number }>>();
  groups.forEach(group => {
    const key = Math.round(group.rankCentre);
    const rank = ranks.get(key);
    if (rank) rank.push(group); else ranks.set(key, [group]);
  });

  ranks.forEach(rank => {
    if (rank.length < 2) return;
    const leading = Math.min(...rank.map(group => (vertical ? group.position.y : group.position.x)));
    rank.forEach(group => {
      if (vertical) group.position.y = leading;
      else group.position.x = leading;
    });
  });

  return groups.map(({ rankCentre: _rankCentre, ...group }) => group);
}

function layoutGroupedArchitecture(
  services: LayoutService[],
  connections: LayoutConnection[],
  groups: LayoutGroup[],
  options: LayoutOptions
): { services: PositionedService[]; groups: PositionedGroup[] } | null {
  const groupMap = new Map(groups.map(group => [group.id, group]));
  const populatedGroups = groups.filter(group => services.some(service => service.groupId === group.id));
  if (populatedGroups.length === 0) return null;

  const subLayouts = new Map<string, GroupSubLayout>();
  populatedGroups.forEach(group => {
    const members = services.filter(service => service.groupId === group.id);
    subLayouts.set(group.id, layoutGroupMembers(members, connections, options.direction, options));
  });

  const ungrouped = services.filter(service => !service.groupId || !groupMap.has(service.groupId));
  const metaGraph = new dagre.graphlib.Graph();
  metaGraph.setGraph({
    rankdir: options.direction,
    nodesep: Math.max(140, Math.round(options.nodeSpacing * 0.7)),
    ranksep: Math.max(220, Math.round(options.rankSpacing * 0.85)),
    marginx: 80,
    marginy: 80,
    edgesep: 40,
    ranker: 'network-simplex',
  });
  metaGraph.setDefaultEdgeLabel(() => ({}));

  const groupWidths = new Map<string, number>();
  populatedGroups.forEach(group => {
    const subLayout = subLayouts.get(group.id)!;
    const headerWidth = group.label.length * 8 + options.groupPadding * 2;
    const width = Math.max(subLayout.width + options.groupPadding * 2, headerWidth);
    const height = subLayout.height + options.groupPadding * 2 + GROUP_HEADER_HEIGHT;
    groupWidths.set(group.id, width);
    metaGraph.setNode(`group:${group.id}`, { width, height });
  });
  ungrouped.forEach(service => {
    metaGraph.setNode(`service:${service.id}`, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  const serviceById = new Map(services.map(service => [service.id, service]));
  const metaId = (serviceId: string): string | null => {
    const service = serviceById.get(serviceId);
    if (!service) return null;
    return service.groupId && groupMap.has(service.groupId)
      ? `group:${service.groupId}`
      : `service:${service.id}`;
  };
  const seenMetaEdges = new Set<string>();
  const directionalMetaIds = new Set<string>();
  connections.forEach(connection => {
    if (isSemanticRelationship(connection)) return;
    const source = metaId(connection.from);
    const target = metaId(connection.to);
    if (!source || !target || source === target || !metaGraph.hasNode(source) || !metaGraph.hasNode(target)) return;
    const key = `${source}\u0000${target}`;
    if (seenMetaEdges.has(key)) return;
    seenMetaEdges.add(key);
    directionalMetaIds.add(source);
    directionalMetaIds.add(target);
    metaGraph.setEdge(source, target, dagreEdgeOptions(connection));
  });
  dagre.layout(metaGraph);

  let positionedGroups: PositionedGroup[] = populatedGroups.map(group => {
    const node = metaGraph.node(`group:${group.id}`);
    const width = groupWidths.get(group.id)!;
    const subLayout = subLayouts.get(group.id)!;
    return {
      ...group,
      position: { x: node.x - width / 2, y: node.y - node.height / 2 },
      width,
      height: subLayout.height + options.groupPadding * 2 + GROUP_HEADER_HEIGHT,
      rankCentre: options.direction === 'TB' || options.direction === 'BT' ? node.y : node.x,
    } as PositionedGroup & { rankCentre: number };
  });
  positionedGroups = alignGroupsWithinRanks(
    positionedGroups as Array<PositionedGroup & { rankCentre: number }>,
    options.direction,
  );

  const positionedGroupByMetaId = new Map(
    positionedGroups.map(group => [`group:${group.id}`, group]),
  );
  const semanticPairs = connections
    .filter(isSemanticRelationship)
    .map(connection => [metaId(connection.from), metaId(connection.to)] as const)
    .filter((pair): pair is readonly [string, string] => Boolean(pair[0] && pair[1] && pair[0] !== pair[1]));
  const semanticAnchorCounts = new Map<string, number>();
  for (const group of positionedGroups) {
    const groupMetaId = `group:${group.id}`;
    if (directionalMetaIds.has(groupMetaId)) continue;
    const pair = semanticPairs.find(([source, target]) => (
      (source === groupMetaId && directionalMetaIds.has(target))
      || (target === groupMetaId && directionalMetaIds.has(source))
    ));
    if (!pair) continue;
    const anchorMetaId = pair[0] === groupMetaId ? pair[1] : pair[0];
    const anchor = positionedGroupByMetaId.get(anchorMetaId);
    if (!anchor) continue;
    const anchorIndex = semanticAnchorCounts.get(anchorMetaId) ?? 0;
    semanticAnchorCounts.set(anchorMetaId, anchorIndex + 1);
    if (options.direction === 'LR' || options.direction === 'RL') {
      group.position.x = anchor.position.x + anchorIndex * (group.width + GROUP_GAP);
      group.position.y = anchor.position.y + anchor.height + GROUP_GAP;
    } else {
      group.position.x = anchor.position.x + anchor.width + GROUP_GAP;
      group.position.y = anchor.position.y + anchorIndex * (group.height + GROUP_GAP);
    }
  }

  const positionedServices: PositionedService[] = services.map(service => {
    if (service.groupId && subLayouts.has(service.groupId)) {
      const position = subLayouts.get(service.groupId)!.positions.get(service.id) ?? { x: 0, y: 0 };
      return {
        ...service,
        position: {
          x: position.x + options.groupPadding,
          y: position.y + options.groupPadding + GROUP_HEADER_HEIGHT,
        },
      };
    }
    const node = metaGraph.node(`service:${service.id}`);
    return {
      ...service,
      position: node
        ? { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 }
        : { x: 0, y: 0 },
    };
  });

  return { services: positionedServices, groups: positionedGroups };
}

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

  const groupedLayout = layoutGroupedArchitecture(services, connections, groups, opts);
  if (groupedLayout) {
    console.log('  ✅ Groups and members positioned in two layout phases');
    return groupedLayout;
  }
  
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
    if (isSemanticRelationship(conn)) return;
    g.setEdge(conn.from, conn.to, dagreEdgeOptions(conn));
  });
  
  // Run layout algorithm
  console.log('  ⚡ Running Dagre layout algorithm...');
  dagre.layout(g);
  
  // Extract positions from graph
  const positionedServices: PositionedService[] = services.map(service => {
    const node = g.node(service.id);
    // Guard against NaN (can happen if a service references a removed/unknown group)
    const sx = isNaN(node?.x) ? 0 : node.x;
    const sy = isNaN(node?.y) ? 0 : node.y;
    if (isNaN(node?.x) || isNaN(node?.y)) {
      console.warn(`  ⚠️ Service "${service.id}" has NaN position from dagre — using fallback`);
    }
    return {
      ...service,
      position: {
        x: sx - (NODE_WIDTH / 2),  // Center the node
        y: sy - (NODE_HEIGHT / 2)
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
      
      // Guard against NaN values from dagre (empty compound nodes produce NaN)
      const gx = isNaN(groupNode.x) ? 0 : groupNode.x;
      const gy = isNaN(groupNode.y) ? 0 : groupNode.y;
      const gw = isNaN(groupNode.width) || groupNode.width <= 0 ? 300 : groupNode.width;
      const gh = isNaN(groupNode.height) || groupNode.height <= 0 ? 200 : groupNode.height;
      
      if (isNaN(groupNode.x) || isNaN(groupNode.y)) {
        console.warn(`  ⚠️ Group "${group.id}" has NaN position from dagre (likely empty compound node) — using fallback`);
      }
      
      return {
        ...group,
        position: {
          x: gx - (gw / 2) - padding,
          y: gy - (gh / 2) - padding
        },
        width: gw + (padding * 2),
        height: gh + (padding * 2)
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
    to: e.target,
    label: e.label,
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
