// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Layout Engine for SpecKit Diagram Rendering
 *
 * Uses dagre to compute hierarchical graph layout for Azure architecture
 * diagrams. Produces positioned nodes and routed edges ready for SVG or
 * HTML rendering.
 */

import dagre from 'dagre';

// ── Types ──────────────────────────────────────────────────────────────

export interface DiagramService {
  name: string;
  type: string;
  description?: string;
  groupId?: string;
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
  type?: 'sync' | 'async' | 'optional';
}

export interface DiagramGroup {
  id: string;
  label: string;
}

export interface PositionedNode {
  name: string;
  type: string;
  description: string;
  category: string;
  groupId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  textColor: string;
}

export interface PositionedEdge {
  from: string;
  to: string;
  label: string;
  type: string;
  points: Array<{ x: number; y: number }>;
}

export interface PositionedGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  groups: PositionedGroup[];
  width: number;
  height: number;
}

// ── Azure category colors ──────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'ai + machine learning':  { bg: '#E8F0FE', border: '#4285F4', text: '#1A73E8' },
  'app services':           { bg: '#E8F4FD', border: '#0078D4', text: '#004578' },
  'compute':                { bg: '#E8F4FD', border: '#0078D4', text: '#004578' },
  'databases':              { bg: '#E6F4EA', border: '#0B8043', text: '#0B6B3A' },
  'storage':                { bg: '#E6F4EA', border: '#137333', text: '#0B6B3A' },
  'networking':             { bg: '#FFF3E0', border: '#E65100', text: '#BF360C' },
  'analytics':              { bg: '#F3E8FD', border: '#7B1FA2', text: '#6A1B9A' },
  'containers':             { bg: '#E0F7FA', border: '#00838F', text: '#006064' },
  'integration':            { bg: '#FCE4EC', border: '#C62828', text: '#B71C1C' },
  'identity':               { bg: '#FFF8E1', border: '#F9A825', text: '#F57F17' },
  'management + governance':{ bg: '#F1F8E9', border: '#558B2F', text: '#33691E' },
  'iot':                    { bg: '#E0F2F1', border: '#00695C', text: '#004D40' },
  'monitor':                { bg: '#EDE7F6', border: '#5E35B1', text: '#4527A0' },
  'security':               { bg: '#FFEBEE', border: '#C62828', text: '#B71C1C' },
  'web':                    { bg: '#E3F2FD', border: '#1565C0', text: '#0D47A1' },
  'other':                  { bg: '#F5F5F5', border: '#616161', text: '#424242' },
};

const GROUP_COLORS = [
  { bg: '#F0F6FF', border: '#0078D4' },   // Azure blue
  { bg: '#F0FFF0', border: '#00B294' },   // Azure green
  { bg: '#FFF8F0', border: '#FFB900' },   // Azure yellow
  { bg: '#F8F0FF', border: '#8764B8' },   // Azure purple
  { bg: '#FFF0F0', border: '#D13438' },   // Azure red
  { bg: '#F0FFFF', border: '#038387' },   // Azure teal
];

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS['other'];
}

// ── Layout computation ─────────────────────────────────────────────────

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;
const PADDING = 40;

export function computeLayout(
  services: DiagramService[],
  connections: DiagramConnection[],
  groups: DiagramGroup[],
  direction: 'TB' | 'LR' = 'TB',
): LayoutResult {
  const g = new dagre.graphlib.Graph({ compound: true });

  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    edgesep: 30,
    marginx: PADDING,
    marginy: PADDING,
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Add group nodes (compound parents)
  const groupMap = new Map(groups.map(gr => [gr.id, gr]));
  for (const group of groups) {
    g.setNode(`group-${group.id}`, {
      label: group.label,
      clusterLabelPos: 'top',
      style: 'fill: transparent',
    });
  }

  // Add service nodes
  const serviceCategories = new Map<string, string>();
  for (const svc of services) {
    const category = resolveCategory(svc.type);
    serviceCategories.set(svc.name, category);

    g.setNode(svc.name, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      label: svc.name,
    });

    // Parent to group if specified
    if (svc.groupId && groupMap.has(svc.groupId)) {
      g.setParent(svc.name, `group-${svc.groupId}`);
    }
  }

  // Add edges
  const serviceNames = new Set(services.map(s => s.name));
  for (const conn of connections) {
    if (serviceNames.has(conn.from) && serviceNames.has(conn.to)) {
      g.setEdge(conn.from, conn.to, {
        label: conn.label ?? '',
        minlen: 1,
      });
    }
  }

  // Run layout
  dagre.layout(g);

  // Extract positioned nodes
  const positionedNodes: PositionedNode[] = services.map(svc => {
    const node = g.node(svc.name);
    const category = serviceCategories.get(svc.name) ?? 'other';
    const colors = getCategoryColor(category);

    return {
      name: svc.name,
      type: svc.type,
      description: svc.description ?? '',
      category,
      groupId: svc.groupId ?? null,
      x: node.x - NODE_WIDTH / 2,
      y: node.y - NODE_HEIGHT / 2,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      color: colors.border,
      textColor: colors.text,
    };
  });

  // Extract positioned edges
  const positionedEdges: PositionedEdge[] = connections
    .filter(c => serviceNames.has(c.from) && serviceNames.has(c.to))
    .map(conn => {
      const edge = g.edge(conn.from, conn.to);
      return {
        from: conn.from,
        to: conn.to,
        label: conn.label ?? '',
        type: conn.type ?? 'sync',
        points: edge?.points ?? [],
      };
    });

  // Extract positioned groups
  const positionedGroups: PositionedGroup[] = groups.map((group, idx) => {
    const gNode = g.node(`group-${group.id}`);
    const groupColor = GROUP_COLORS[idx % GROUP_COLORS.length];
    if (!gNode) {
      return {
        id: group.id,
        label: group.label,
        x: 0, y: 0, width: 0, height: 0,
        color: groupColor.border,
      };
    }
    return {
      id: group.id,
      label: group.label,
      x: gNode.x - (gNode.width ?? 200) / 2,
      y: gNode.y - (gNode.height ?? 100) / 2,
      width: gNode.width ?? 200,
      height: gNode.height ?? 100,
      color: groupColor.border,
    };
  }).filter(g => g.width > 0);

  // Compute canvas bounds
  const graphInfo = g.graph();
  const width = (graphInfo.width ?? 800) + PADDING * 2;
  const height = (graphInfo.height ?? 600) + PADDING * 2;

  return { nodes: positionedNodes, edges: positionedEdges, groups: positionedGroups, width, height };
}

// ── Category resolver ──────────────────────────────────────────────────

const TYPE_TO_CATEGORY: Record<string, string> = {
  'azure openai': 'ai + machine learning', 'cognitive services': 'ai + machine learning',
  'computer vision': 'ai + machine learning', 'custom vision': 'ai + machine learning',
  'speech services': 'ai + machine learning', 'translator': 'ai + machine learning',
  'language': 'ai + machine learning', 'document intelligence': 'ai + machine learning',
  'azure machine learning': 'ai + machine learning', 'azure cognitive search': 'ai + machine learning',
  'virtual machines': 'compute', 'functions': 'compute',
  'app service': 'app services',
  'container instances': 'containers', 'kubernetes service': 'containers',
  'container registry': 'containers', 'container apps': 'containers',
  'azure cosmos db': 'databases', 'sql database': 'databases',
  'postgresql': 'databases', 'mysql': 'databases', 'redis cache': 'databases',
  'storage account': 'storage', 'data lake storage': 'storage',
  'application gateway': 'networking', 'azure front door': 'networking',
  'cdn': 'networking', 'virtual network': 'networking', 'load balancer': 'networking',
  'azure firewall': 'networking', 'vpn gateway': 'networking', 'expressroute': 'networking',
  'traffic manager': 'networking', 'azure bastion': 'networking',
  'azure ddos protection': 'networking', 'private link': 'networking', 'azure dns': 'networking',
  'network watcher': 'networking', 'web application firewall': 'networking',
  'data factory': 'analytics', 'azure synapse analytics': 'analytics',
  'stream analytics': 'analytics', 'event hubs': 'analytics',
  'power bi embedded': 'analytics', 'azure workbooks': 'analytics',
  'service bus': 'integration', 'logic apps': 'integration',
  'api management': 'integration', 'event grid': 'integration',
  'azure api for fhir': 'integration',
  'signalr service': 'web', 'static web apps': 'web',
  'azure monitor': 'monitor', 'application insights': 'monitor', 'log analytics': 'monitor',
  'azure managed grafana': 'monitor',
  'key vault': 'security', 'microsoft defender for cloud': 'security',
  'microsoft sentinel': 'security',
  'microsoft entra id': 'identity',
  'backup': 'management + governance', 'azure policy': 'management + governance',
  'microsoft purview': 'management + governance',
  'iot hub': 'iot', 'iot central': 'iot', 'digital twins': 'iot', 'notification hubs': 'iot',
};

function resolveCategory(serviceType: string): string {
  return TYPE_TO_CATEGORY[serviceType.toLowerCase()] ?? 'other';
}
