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
  nodeSpacing: 150,     // Space between nodes horizontally
  rankSpacing: 200,     // Space between layers vertically
  groupPadding: 80      // Padding inside groups
};

const NODE_WIDTH = 180;   // Standard node width
const NODE_HEIGHT = 100;  // Standard node height

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
    marginx: 50,
    marginy: 50,
    edgesep: 50
  });
  
  // Set default edge label
  g.setDefaultEdgeLabel(() => ({}));
  
  // Add groups as parent nodes first (if any)
  groups.forEach(group => {
    g.setNode(group.id, {
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
      g.setParent(service.id, service.groupId);
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
      const groupNode = g.node(group.id);
      
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
  
  // Convert grouped service positions to be relative to their parent group
  const finalServices = positionedServices.map(service => {
    if (service.groupId) {
      const parentGroup = positionedGroups.find(g => g.id === service.groupId);
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
  
  console.log('  ✅ Groups positioned and positions made relative');
  console.log('📐 Layout complete!');
  
  return {
    services: finalServices,
    groups: positionedGroups
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
