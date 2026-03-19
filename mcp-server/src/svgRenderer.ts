// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * SVG Renderer for SpecKit Diagrams
 *
 * Generates professional Azure-branded SVG architecture diagrams from
 * positioned layout data. Produces self-contained SVG markup that can be
 * embedded directly in SpecKit markdown files, replacing Mermaid blocks.
 *
 * Features:
 *   - Azure category-colored service nodes with rounded corners
 *   - Service type badges (abbreviated)
 *   - Labeled connection edges with directional arrows
 *   - Group containers with headers
 *   - Responsive viewBox for any diagram size
 */

import type { LayoutResult, PositionedNode, PositionedEdge, PositionedGroup } from './layoutEngine.js';

// ── Category abbreviations for type badges ─────────────────────────────

const TYPE_ABBREVIATIONS: Record<string, string> = {
  'app service': 'App Svc',
  'azure functions': 'Func',
  'functions': 'Func',
  'virtual machines': 'VM',
  'azure cosmos db': 'Cosmos DB',
  'sql database': 'SQL DB',
  'storage account': 'Storage',
  'azure openai': 'OpenAI',
  'kubernetes service': 'AKS',
  'container apps': 'ACA',
  'container registry': 'ACR',
  'container instances': 'ACI',
  'application gateway': 'App GW',
  'azure front door': 'Front Door',
  'api management': 'APIM',
  'key vault': 'Key Vault',
  'microsoft entra id': 'Entra ID',
  'application insights': 'App Insights',
  'azure monitor': 'Monitor',
  'log analytics': 'Log Analytics',
  'service bus': 'Service Bus',
  'event hubs': 'Event Hubs',
  'event grid': 'Event Grid',
  'redis cache': 'Redis',
  'logic apps': 'Logic Apps',
  'azure firewall': 'Firewall',
  'load balancer': 'LB',
  'virtual network': 'VNet',
  'azure bastion': 'Bastion',
  'azure machine learning': 'Azure ML',
  'azure cognitive search': 'AI Search',
  'microsoft defender for cloud': 'Defender',
  'microsoft sentinel': 'Sentinel',
  'data factory': 'ADF',
  'azure synapse analytics': 'Synapse',
  'traffic manager': 'TM',
  'static web apps': 'SWA',
  'signalr service': 'SignalR',
  'backup': 'Backup',
  'azure policy': 'Policy',
  'postgresql': 'PostgreSQL',
  'mysql': 'MySQL',
};

function abbreviateType(type: string): string {
  return TYPE_ABBREVIATIONS[type.toLowerCase()] ?? type;
}

// ── Category icon symbols (simple Unicode) ─────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  'ai + machine learning': '🤖',
  'app services': '🌐',
  'compute': '⚡',
  'databases': '🗄️',
  'storage': '💾',
  'networking': '🔗',
  'analytics': '📊',
  'containers': '📦',
  'integration': '🔄',
  'identity': '🔑',
  'management + governance': '⚙️',
  'iot': '📡',
  'monitor': '📈',
  'security': '🛡️',
  'web': '🌍',
  'other': '☁️',
};

// ── Edge styling ───────────────────────────────────────────────────────

const EDGE_STYLES: Record<string, { color: string; dasharray: string }> = {
  sync: { color: '#0078D4', dasharray: '' },
  async: { color: '#8764B8', dasharray: '6,4' },
  optional: { color: '#A0A0A0', dasharray: '4,4' },
};

// ── SVG generation ─────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderNode(node: PositionedNode): string {
  const icon = CATEGORY_ICONS[node.category] ?? '☁️';
  const typeAbbr = abbreviateType(node.type);
  const rx = 8;

  return `
    <!-- ${escapeXml(node.name)} -->
    <g class="node" data-service="${escapeXml(node.name)}" data-type="${escapeXml(node.type)}">
      <!-- Shadow -->
      <rect x="${node.x + 2}" y="${node.y + 2}" width="${node.width}" height="${node.height}"
            rx="${rx}" fill="#00000010" />
      <!-- Card -->
      <rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}"
            rx="${rx}" fill="white" stroke="${node.color}" stroke-width="2" />
      <!-- Color accent bar -->
      <rect x="${node.x}" y="${node.y}" width="6" height="${node.height}"
            rx="3" fill="${node.color}" />
      <!-- Icon + Name -->
      <text x="${node.x + 18}" y="${node.y + 28}" font-family="Segoe UI, system-ui, sans-serif"
            font-size="13" font-weight="600" fill="#1B1B1B">
        ${icon} ${escapeXml(node.name)}
      </text>
      <!-- Type badge -->
      <text x="${node.x + 18}" y="${node.y + 48}" font-family="Segoe UI, system-ui, sans-serif"
            font-size="11" fill="${node.color}">
        ${escapeXml(typeAbbr)}
      </text>
    </g>`;
}

function renderEdge(edge: PositionedEdge): string {
  if (edge.points.length < 2) return '';

  const style = EDGE_STYLES[edge.type] ?? EDGE_STYLES.sync;
  const pathData = edge.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Arrowhead position: last two points
  const last = edge.points[edge.points.length - 1];
  const prev = edge.points[edge.points.length - 2];
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x);
  const arrowLen = 10;
  const arrowPoints = [
    `${last.x},${last.y}`,
    `${last.x - arrowLen * Math.cos(angle - 0.4)},${last.y - arrowLen * Math.sin(angle - 0.4)}`,
    `${last.x - arrowLen * Math.cos(angle + 0.4)},${last.y - arrowLen * Math.sin(angle + 0.4)}`,
  ].join(' ');

  // Label at midpoint
  const mid = edge.points[Math.floor(edge.points.length / 2)];
  const labelSvg = edge.label
    ? `<g>
        <rect x="${mid.x - edge.label.length * 3.5 - 4}" y="${mid.y - 9}" 
              width="${edge.label.length * 7 + 8}" height="16" rx="3"
              fill="white" stroke="${style.color}" stroke-width="0.5" opacity="0.95" />
        <text x="${mid.x}" y="${mid.y + 3}" text-anchor="middle"
              font-family="Segoe UI, system-ui, sans-serif" font-size="10"
              fill="${style.color}">${escapeXml(edge.label)}</text>
      </g>`
    : '';

  return `
    <g class="edge" data-from="${escapeXml(edge.from)}" data-to="${escapeXml(edge.to)}">
      <path d="${pathData}" fill="none" stroke="${style.color}" stroke-width="1.5"
            ${style.dasharray ? `stroke-dasharray="${style.dasharray}"` : ''} />
      <polygon points="${arrowPoints}" fill="${style.color}" />
      ${labelSvg}
    </g>`;
}

function renderGroup(group: PositionedGroup): string {
  const pad = 12;
  return `
    <g class="group" data-group="${escapeXml(group.id)}">
      <rect x="${group.x - pad}" y="${group.y - pad - 20}" 
            width="${group.width + pad * 2}" height="${group.height + pad * 2 + 20}"
            rx="12" fill="${group.color}08" stroke="${group.color}" 
            stroke-width="1.5" stroke-dasharray="6,3" />
      <text x="${group.x + group.width / 2}" y="${group.y - pad - 4}" text-anchor="middle"
            font-family="Segoe UI, system-ui, sans-serif" font-size="12" font-weight="600"
            fill="${group.color}">${escapeXml(group.label)}</text>
    </g>`;
}

// ── Public API ─────────────────────────────────────────────────────────

export function renderSvg(layout: LayoutResult, title?: string): string {
  const titleBar = title
    ? `<text x="${layout.width / 2}" y="24" text-anchor="middle"
            font-family="Segoe UI, system-ui, sans-serif" font-size="16" font-weight="700"
            fill="#1B1B1B">${escapeXml(title)}</text>`
    : '';

  const titleOffset = title ? 40 : 0;
  const totalHeight = layout.height + titleOffset;

  // Build legend from unique categories
  const categories = [...new Set(layout.nodes.map(n => n.category))].sort();
  const legendY = totalHeight - 20;
  const legend = categories
    .map((cat, i) => {
      const icon = CATEGORY_ICONS[cat] ?? '☁️';
      const x = 20 + i * 160;
      return `<text x="${x}" y="${legendY}" font-family="Segoe UI, system-ui, sans-serif" 
                    font-size="10" fill="#666">${icon} ${escapeXml(cat)}</text>`;
    })
    .join('\n');

  const totalWithLegend = totalHeight + 30;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="0 0 ${layout.width} ${totalWithLegend}"
     width="${layout.width}" height="${totalWithLegend}"
     style="background: white; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;">

  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="1" dy="1" stdDeviation="2" flood-opacity="0.1"/>
    </filter>
  </defs>

  ${titleBar}

  <g transform="translate(0, ${titleOffset})">
    <!-- Groups (background) -->
    ${layout.groups.map(renderGroup).join('\n')}

    <!-- Edges -->
    ${layout.edges.map(renderEdge).join('\n')}

    <!-- Nodes (foreground) -->
    ${layout.nodes.map(renderNode).join('\n')}
  </g>

  <!-- Legend -->
  ${legend}

  <!-- Watermark -->
  <text x="${layout.width - 10}" y="${totalWithLegend - 8}" text-anchor="end"
        font-family="Segoe UI, system-ui, sans-serif" font-size="9" fill="#CCC">
    Generated by Azure Architecture Diagram Builder
  </text>
</svg>`;
}
