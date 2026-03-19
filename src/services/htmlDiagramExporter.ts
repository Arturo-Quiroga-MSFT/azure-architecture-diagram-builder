// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * HTML Diagram Exporter
 *
 * Exports the current React Flow diagram as a self-contained interactive HTML
 * file. Uses dagre for layout computation and renders Azure-branded nodes,
 * edges, groups, tooltips, and pan/zoom — the same visual style produced by
 * the render_diagram MCP tool.
 */

import dagre from 'dagre';
import type { Node, Edge } from 'reactflow';

// ── Types ──────────────────────────────────────────────────────────────

interface DiagramService {
  name: string;
  type: string;
  description: string;
  groupId: string | null;
}

interface DiagramConnection {
  from: string;
  to: string;
  label: string;
  type: 'sync' | 'async' | 'optional';
}

interface DiagramGroup {
  id: string;
  label: string;
}

interface PositionedNode {
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

interface PositionedEdge {
  from: string;
  to: string;
  label: string;
  type: string;
  points: Array<{ x: number; y: number }>;
}

interface PositionedGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface LayoutResult {
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
  { bg: '#F0F6FF', border: '#0078D4' },
  { bg: '#F0FFF0', border: '#00B294' },
  { bg: '#FFF8F0', border: '#FFB900' },
  { bg: '#F8F0FF', border: '#8764B8' },
  { bg: '#FFF0F0', border: '#D13438' },
  { bg: '#F0FFFF', border: '#038387' },
];

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

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS['other'];
}

// ── Extract diagram data from React Flow ───────────────────────────────

function extractDiagramData(nodes: Node[], edges: Edge[]): {
  services: DiagramService[];
  connections: DiagramConnection[];
  groups: DiagramGroup[];
} {
  const services: DiagramService[] = nodes
    .filter(n => n.type === 'azureNode')
    .map(n => ({
      name: (n.data.label as string) || 'Unknown Service',
      type: (n.data.serviceName as string) || (n.data.label as string) || 'Unknown',
      description: (n.data.description as string) || '',
      groupId: n.parentNode ?? null,
    }));

  const nodeNameById = new Map<string, string>();
  for (const n of nodes) {
    if (n.type === 'azureNode') {
      nodeNameById.set(n.id, (n.data.label as string) || 'Unknown');
    }
  }

  const connections: DiagramConnection[] = edges
    .filter(e => nodeNameById.has(e.source) && nodeNameById.has(e.target))
    .map(e => ({
      from: nodeNameById.get(e.source)!,
      to: nodeNameById.get(e.target)!,
      label: typeof e.label === 'string' ? e.label : '',
      type: (e.data?.connectionType as 'sync' | 'async' | 'optional') ?? 'sync',
    }));

  const groups: DiagramGroup[] = nodes
    .filter(n => n.type === 'groupNode')
    .map(n => ({
      id: n.id,
      label: (n.data.label as string) || 'Group',
    }));

  return { services, connections, groups };
}

// ── Dagre layout computation ───────────────────────────────────────────

const NODE_WIDTH = 200;
const NODE_HEIGHT = 70;
const PADDING = 40;

function computeLayout(
  services: DiagramService[],
  connections: DiagramConnection[],
  groups: DiagramGroup[],
): LayoutResult {
  const g = new dagre.graphlib.Graph({ compound: true });

  g.setGraph({
    rankdir: 'TB',
    nodesep: 60,
    ranksep: 80,
    edgesep: 30,
    marginx: PADDING,
    marginy: PADDING,
  });

  g.setDefaultEdgeLabel(() => ({}));

  const groupMap = new Map(groups.map(gr => [gr.id, gr]));
  for (const group of groups) {
    g.setNode(`group-${group.id}`, {
      label: group.label,
      clusterLabelPos: 'top',
      style: 'fill: transparent',
    });
  }

  const serviceCategories = new Map<string, string>();
  for (const svc of services) {
    const category = resolveCategory(svc.type);
    serviceCategories.set(svc.name, category);

    g.setNode(svc.name, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      label: svc.name,
    });

    if (svc.groupId && groupMap.has(svc.groupId)) {
      g.setParent(svc.name, `group-${svc.groupId}`);
    }
  }

  const serviceNames = new Set(services.map(s => s.name));
  for (const conn of connections) {
    if (serviceNames.has(conn.from) && serviceNames.has(conn.to)) {
      g.setEdge(conn.from, conn.to, {
        label: conn.label ?? '',
        minlen: 1,
      });
    }
  }

  dagre.layout(g);

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

  const positionedGroups: PositionedGroup[] = groups.map((group, idx) => {
    const gNode = g.node(`group-${group.id}`);
    const groupColor = GROUP_COLORS[idx % GROUP_COLORS.length];
    if (!gNode) {
      return { id: group.id, label: group.label, x: 0, y: 0, width: 0, height: 0, color: groupColor.border };
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

  const graphInfo = g.graph();
  const width = (graphInfo.width ?? 800) + PADDING * 2;
  const height = (graphInfo.height ?? 600) + PADDING * 2;

  return { nodes: positionedNodes, edges: positionedEdges, groups: positionedGroups, width, height };
}

// ── HTML generation ────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateHtml(layout: LayoutResult, title: string): string {
  const layoutJson = JSON.stringify(layout);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #f8f9fa; overflow: hidden; }
  .header {
    background: linear-gradient(135deg, #0078D4, #005A9E);
    color: white; padding: 12px 24px; display: flex; align-items: center; gap: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 100; position: relative;
  }
  .header h1 { font-size: 18px; font-weight: 600; }
  .header .meta { font-size: 12px; opacity: 0.8; margin-left: auto; }
  .header .controls { display: flex; gap: 6px; }
  .header button {
    background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3);
    color: white; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;
  }
  .header button:hover { background: rgba(255,255,255,0.3); }
  .canvas-container { width: 100vw; height: calc(100vh - 52px); overflow: hidden; position: relative; cursor: grab; }
  .canvas-container.dragging { cursor: grabbing; }
  .canvas { position: absolute; transform-origin: 0 0; }
  .node {
    position: absolute; width: 200px; height: 70px; background: white;
    border-radius: 8px; border: 2px solid #ccc; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    cursor: pointer; transition: box-shadow 0.2s, transform 0.2s;
    display: flex; flex-direction: column; justify-content: center; padding: 0 14px 0 20px;
    overflow: hidden;
  }
  .node:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.15); transform: translateY(-1px); z-index: 10; }
  .node.highlighted { box-shadow: 0 0 0 3px rgba(0,120,212,0.4), 0 4px 16px rgba(0,0,0,0.15); }
  .node .accent { position: absolute; left: 0; top: 0; width: 6px; height: 100%; border-radius: 3px 0 0 3px; }
  .node .name { font-size: 13px; font-weight: 600; color: #1B1B1B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .node .type { font-size: 11px; margin-top: 2px; }
  .edges-layer { position: absolute; top: 0; left: 0; pointer-events: none; }
  .edge-path { fill: none; stroke-width: 1.5; }
  .edge-label {
    font-family: 'Segoe UI', system-ui, sans-serif; font-size: 10px;
    paint-order: stroke; stroke: white; stroke-width: 3px;
  }
  .group {
    position: absolute; border-radius: 12px; border: 1.5px dashed;
  }
  .group .group-label {
    position: absolute; top: -18px; left: 50%; transform: translateX(-50%);
    font-size: 12px; font-weight: 600; white-space: nowrap;
  }
  .tooltip {
    position: fixed; display: none; background: #1B1B1B; color: white;
    padding: 8px 12px; border-radius: 6px; font-size: 12px; max-width: 280px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 1000; pointer-events: none;
  }
  .tooltip .tt-name { font-weight: 600; margin-bottom: 4px; }
  .tooltip .tt-type { opacity: 0.7; font-size: 11px; }
  .tooltip .tt-desc { margin-top: 4px; font-size: 11px; opacity: 0.85; }
  .legend {
    position: fixed; bottom: 12px; left: 12px; background: white;
    border-radius: 8px; padding: 10px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    font-size: 11px; display: flex; gap: 12px; flex-wrap: wrap; max-width: 600px; z-index: 50;
  }
  .legend-item { display: flex; align-items: center; gap: 4px; }
  .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
</style>
</head>
<body>

<div class="header">
  <h1>${esc(title)}</h1>
  <div class="controls">
    <button onclick="zoomIn()">+</button>
    <button onclick="zoomOut()">\\u2212</button>
    <button onclick="resetView()">Reset</button>
    <button onclick="fitView()">Fit</button>
  </div>
  <div class="meta">Generated by Azure Architecture Diagram Builder</div>
</div>

<div class="canvas-container" id="container">
  <div class="canvas" id="canvas"></div>
</div>

<div class="tooltip" id="tooltip">
  <div class="tt-name"></div>
  <div class="tt-type"></div>
  <div class="tt-desc"></div>
</div>

<div class="legend" id="legend"></div>

<script>
const layout = ${layoutJson};

const CATEGORY_COLORS = {
  'ai + machine learning':  { bg: '#E8F0FE', border: '#4285F4' },
  'app services':           { bg: '#E8F4FD', border: '#0078D4' },
  'compute':                { bg: '#E8F4FD', border: '#0078D4' },
  'databases':              { bg: '#E6F4EA', border: '#0B8043' },
  'storage':                { bg: '#E6F4EA', border: '#137333' },
  'networking':             { bg: '#FFF3E0', border: '#E65100' },
  'analytics':              { bg: '#F3E8FD', border: '#7B1FA2' },
  'containers':             { bg: '#E0F7FA', border: '#00838F' },
  'integration':            { bg: '#FCE4EC', border: '#C62828' },
  'identity':               { bg: '#FFF8E1', border: '#F9A825' },
  'management + governance':{ bg: '#F1F8E9', border: '#558B2F' },
  'iot':                    { bg: '#E0F2F1', border: '#00695C' },
  'monitor':                { bg: '#EDE7F6', border: '#5E35B1' },
  'security':               { bg: '#FFEBEE', border: '#C62828' },
  'web':                    { bg: '#E3F2FD', border: '#1565C0' },
  'other':                  { bg: '#F5F5F5', border: '#616161' },
};

const CATEGORY_ICONS = {
  'ai + machine learning': '\\ud83e\\udd16', 'app services': '\\ud83c\\udf10', 'compute': '\\u26a1',
  'databases': '\\ud83d\\uddc4\\ufe0f', 'storage': '\\ud83d\\udcbe', 'networking': '\\ud83d\\udd17', 'analytics': '\\ud83d\\udcca',
  'containers': '\\ud83d\\udce6', 'integration': '\\ud83d\\udd04', 'identity': '\\ud83d\\udd11',
  'management + governance': '\\u2699\\ufe0f', 'iot': '\\ud83d\\udce1', 'monitor': '\\ud83d\\udcc8',
  'security': '\\ud83d\\udee1\\ufe0f', 'web': '\\ud83c\\udf0d', 'other': '\\u2601\\ufe0f',
};

const EDGE_COLORS = { sync: '#0078D4', async: '#8764B8', optional: '#A0A0A0' };
const GROUP_COLORS = [
  { bg: '#F0F6FF08', border: '#0078D4' },
  { bg: '#F0FFF008', border: '#00B294' },
  { bg: '#FFF8F008', border: '#FFB900' },
  { bg: '#F8F0FF08', border: '#8764B8' },
  { bg: '#FFF0F008', border: '#D13438' },
  { bg: '#F0FFFF08', border: '#038387' },
];

let scale = 1, offsetX = 0, offsetY = 0, isDragging = false, dragStartX = 0, dragStartY = 0;
const container = document.getElementById('container');
const canvas = document.getElementById('canvas');
const tooltip = document.getElementById('tooltip');

function render() {
  canvas.innerHTML = '';
  canvas.style.width = layout.width + 'px';
  canvas.style.height = layout.height + 'px';

  layout.groups.forEach((g, i) => {
    const gc = GROUP_COLORS[i % GROUP_COLORS.length];
    const el = document.createElement('div');
    el.className = 'group';
    el.style.left = (g.x - 12) + 'px';
    el.style.top = (g.y - 32) + 'px';
    el.style.width = (g.width + 24) + 'px';
    el.style.height = (g.height + 44) + 'px';
    el.style.borderColor = gc.border;
    el.style.background = gc.border + '08';
    el.innerHTML = '<div class="group-label" style="color:' + gc.border + '">' + esc(g.label) + '</div>';
    canvas.appendChild(el);
  });

  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.classList.add('edges-layer');
  svg.setAttribute('width', layout.width);
  svg.setAttribute('height', layout.height);
  svg.style.width = layout.width + 'px';
  svg.style.height = layout.height + 'px';

  const defs = document.createElementNS(svgNs, 'defs');
  ['sync', 'async', 'optional'].forEach(t => {
    const marker = document.createElementNS(svgNs, 'marker');
    marker.setAttribute('id', 'arrow-' + t);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '10'); marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '8'); marker.setAttribute('markerHeight', '8');
    marker.setAttribute('orient', 'auto');
    const poly = document.createElementNS(svgNs, 'polygon');
    poly.setAttribute('points', '0,0 10,5 0,10');
    poly.setAttribute('fill', EDGE_COLORS[t]);
    marker.appendChild(poly);
    defs.appendChild(marker);
  });
  svg.appendChild(defs);

  layout.edges.forEach(e => {
    if (e.points.length < 2) return;
    const eType = e.type || 'sync';
    const color = EDGE_COLORS[eType] || EDGE_COLORS.sync;
    const d = e.points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y).join(' ');
    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', color);
    path.classList.add('edge-path');
    path.setAttribute('marker-end', 'url(#arrow-' + eType + ')');
    if (eType === 'async') path.setAttribute('stroke-dasharray', '6,4');
    if (eType === 'optional') path.setAttribute('stroke-dasharray', '4,4');
    svg.appendChild(path);

    if (e.label) {
      const mid = e.points[Math.floor(e.points.length / 2)];
      const text = document.createElementNS(svgNs, 'text');
      text.setAttribute('x', mid.x);
      text.setAttribute('y', mid.y - 4);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', color);
      text.classList.add('edge-label');
      text.textContent = e.label;
      svg.appendChild(text);
    }
  });
  canvas.appendChild(svg);

  layout.nodes.forEach(n => {
    const cc = CATEGORY_COLORS[n.category] || CATEGORY_COLORS.other;
    const icon = CATEGORY_ICONS[n.category] || '\\u2601\\ufe0f';
    const el = document.createElement('div');
    el.className = 'node';
    el.style.left = n.x + 'px';
    el.style.top = n.y + 'px';
    el.style.width = n.width + 'px';
    el.style.height = n.height + 'px';
    el.style.borderColor = cc.border;
    el.innerHTML =
      '<div class="accent" style="background:' + cc.border + '"></div>' +
      '<div class="name">' + icon + ' ' + esc(n.name) + '</div>' +
      '<div class="type" style="color:' + cc.border + '">' + esc(n.type) + '</div>';

    el.addEventListener('mouseenter', ev => showTooltip(ev, n));
    el.addEventListener('mouseleave', hideTooltip);
    el.addEventListener('click', () => {
      document.querySelectorAll('.node').forEach(nd => nd.classList.remove('highlighted'));
      el.classList.toggle('highlighted');
    });
    canvas.appendChild(el);
  });

  const cats = [...new Set(layout.nodes.map(n => n.category))].sort();
  const legendEl = document.getElementById('legend');
  legendEl.innerHTML = cats.map(c => {
    const cc = CATEGORY_COLORS[c] || CATEGORY_COLORS.other;
    return '<div class="legend-item"><div class="legend-dot" style="background:' + cc.border + '"></div>' + (CATEGORY_ICONS[c] || '') + ' ' + c + '</div>';
  }).join('');

  applyTransform();
}

function applyTransform() {
  canvas.style.transform = 'translate(' + offsetX + 'px,' + offsetY + 'px) scale(' + scale + ')';
}

function showTooltip(ev, n) {
  tooltip.style.display = 'block';
  tooltip.style.left = (ev.clientX + 12) + 'px';
  tooltip.style.top = (ev.clientY + 12) + 'px';
  tooltip.querySelector('.tt-name').textContent = n.name;
  tooltip.querySelector('.tt-type').textContent = n.type + ' (' + n.category + ')';
  tooltip.querySelector('.tt-desc').textContent = n.description || '';
}
function hideTooltip() { tooltip.style.display = 'none'; }

container.addEventListener('mousedown', e => {
  if (e.target.closest('.node')) return;
  isDragging = true; dragStartX = e.clientX - offsetX; dragStartY = e.clientY - offsetY;
  container.classList.add('dragging');
});
window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  offsetX = e.clientX - dragStartX; offsetY = e.clientY - dragStartY;
  applyTransform();
});
window.addEventListener('mouseup', () => { isDragging = false; container.classList.remove('dragging'); });

container.addEventListener('wheel', e => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  const rect = container.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const newScale = Math.max(0.1, Math.min(5, scale * delta));
  offsetX = mx - (mx - offsetX) * (newScale / scale);
  offsetY = my - (my - offsetY) * (newScale / scale);
  scale = newScale;
  applyTransform();
}, { passive: false });

function zoomIn() { scale = Math.min(5, scale * 1.2); applyTransform(); }
function zoomOut() { scale = Math.max(0.1, scale * 0.8); applyTransform(); }
function resetView() { scale = 1; offsetX = 0; offsetY = 0; applyTransform(); }
function fitView() {
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  scale = Math.min(cw / layout.width, ch / layout.height) * 0.9;
  offsetX = (cw - layout.width * scale) / 2;
  offsetY = (ch - layout.height * scale) / 2;
  applyTransform();
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

render();
fitView();
<\/script>
</body>
</html>`;
}

// ── Public API ─────────────────────────────────────────────────────────

export function exportDiagramAsHtml(
  nodes: Node[],
  edges: Edge[],
  title?: string,
): void {
  const diagramTitle = title || 'Azure Architecture Diagram';
  const { services, connections, groups } = extractDiagramData(nodes, edges);

  if (services.length === 0) {
    alert('No services to export. Add Azure services to the diagram first.');
    return;
  }

  const layout = computeLayout(services, connections, groups);
  const html = generateHtml(layout, diagramTitle);

  // Trigger download
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${diagramTitle.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
