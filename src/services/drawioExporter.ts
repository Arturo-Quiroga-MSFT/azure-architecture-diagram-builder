// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Draw.io (diagrams.net) Export Service
 * 
 * Converts React Flow diagrams to draw.io compatible XML format (.drawio)
 * enabling users to import and edit diagrams in draw.io/diagrams.net
 * 
 * Icons are embedded as Base64-encoded data URIs for full offline support
 * 
 * @author Arturo Quiroga
 * @date January 2026
 */

import { Node, Edge } from 'reactflow';
import { generateModelFilename } from '../utils/modelNaming';

// Load SVG icon and convert to Base64 data URI for Draw.io
async function loadIconAsBase64(iconPath: string): Promise<string | null> {
  if (!iconPath) {
    console.log('[Draw.io Export] No icon path provided');
    return null;
  }
  
  try {
    console.log('[Draw.io Export] Loading icon:', iconPath);
    
    // Fetch the SVG file
    const response = await fetch(iconPath);
    if (!response.ok) {
      console.warn(`[Draw.io Export] Failed to load icon (${response.status}): ${iconPath}`);
      return null;
    }
    
    const svgText = await response.text();
    console.log('[Draw.io Export] Icon loaded, size:', svgText.length, 'bytes');
    
    // Convert to Base64 using modern approach
    const encoder = new TextEncoder();
    const data = encoder.encode(svgText);
    let binary = '';
    const len = data.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(data[i]);
    }
    const base64 = btoa(binary);
    
    console.log('[Draw.io Export] Base64 encoded, size:', base64.length, 'chars');
    
    // Return as data URI - Draw.io format: data:image/svg+xml,BASE64
    // Note: Draw.io uses comma separator, not semicolon+base64
    return `data:image/svg+xml,${base64}`;
  } catch (error) {
    console.error(`[Draw.io Export] Error loading icon ${iconPath}:`, error);
    return null;
  }
}

// Draw.io XML escape helper
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate unique IDs for draw.io cells
let cellIdCounter = 2; // 0 and 1 are reserved for root cells
function generateCellId(): string {
  return `cell-${cellIdCounter++}`;
}

// Reset cell ID counter (call before each export)
function resetCellIdCounter(): void {
  cellIdCounter = 2;
}

// Map Azure category to draw.io fill colors
function getCategoryFillColor(category: string): string {
  const colorMap: { [key: string]: string } = {
    'compute': '#dbeafe',           // Light blue
    'containers': '#dbeafe',
    'databases': '#d1fae5',         // Light green
    'storage': '#d1fae5',
    'data layer': '#d1fae5',
    'ai + machine learning': '#fef3c7', // Light orange/yellow
    'analytics': '#ede9fe',         // Light purple
    'networking': '#cffafe',        // Light cyan
    'identity': '#fce7f3',          // Light pink
    'security': '#fee2e2',          // Light red
    'monitor': '#e0e7ff',           // Light indigo
    'integration': '#ccfbf1',       // Light teal
    'iot': '#ffedd5',               // Light orange
    'app services': '#dbeafe',      // Light blue
    'web': '#dbeafe',
    'devops': '#ede9fe',            // Light purple
  };
  
  const normalizedCategory = category?.toLowerCase() || '';
  return colorMap[normalizedCategory] || '#f3f4f6'; // Default light gray
}

// Map Azure category to draw.io stroke colors
function getCategoryStrokeColor(category: string): string {
  const colorMap: { [key: string]: string } = {
    'compute': '#0078d4',
    'containers': '#0078d4',
    'databases': '#10b981',
    'storage': '#10b981',
    'data layer': '#10b981',
    'ai + machine learning': '#f59e0b',
    'analytics': '#8b5cf6',
    'networking': '#06b6d4',
    'identity': '#ec4899',
    'security': '#ef4444',
    'monitor': '#6366f1',
    'integration': '#14b8a6',
    'iot': '#f97316',
    'app services': '#3b82f6',
    'web': '#3b82f6',
    'devops': '#8b5cf6',
  };
  
  const normalizedCategory = category?.toLowerCase() || '';
  return colorMap[normalizedCategory] || '#6b7280';
}

// Map group categories to colors
function getGroupFillColor(label: string): string {
  const normalizedLabel = label.toLowerCase();
  
  if (normalizedLabel.includes('web') || normalizedLabel.includes('frontend')) {
    return '#dbeafe';
  } else if (normalizedLabel.includes('data') || normalizedLabel.includes('storage')) {
    return '#d1fae5';
  } else if (normalizedLabel.includes('security') || normalizedLabel.includes('identity')) {
    return '#fee2e2';
  } else if (normalizedLabel.includes('monitor') || normalizedLabel.includes('ops')) {
    return '#e0e7ff';
  } else if (normalizedLabel.includes('ai') || normalizedLabel.includes('ml') || normalizedLabel.includes('analytics')) {
    return '#fef3c7';
  } else if (normalizedLabel.includes('api') || normalizedLabel.includes('compute') || normalizedLabel.includes('application')) {
    return '#cffafe';
  }
  
  return '#f9fafb'; // Default very light gray
}

// Connection type to draw.io edge style
function getEdgeStyle(edgeType?: string): string {
  switch (edgeType) {
    case 'async':
      return 'dashed=1;dashPattern=8 8;';
    case 'optional':
      return 'dashed=1;dashPattern=4 4;strokeColor=#9ca3af;';
    case 'sync':
    default:
      return 'dashed=0;';
  }
}

// Create draw.io mxCell for a group node (container/swimlane)
function createGroupCell(node: Node, cellId: string): string {
  const x = node.position?.x || 0;
  const y = node.position?.y || 0;
  const width = (node as any).width || node.data?.width || 400;
  const height = (node as any).height || node.data?.height || 300;
  const label = escapeXml(node.data?.label || 'Group');
  const fillColor = getGroupFillColor(label);
  
  // Use swimlane style for groups (collapsible container with header)
  const style = `swimlane;whiteSpace=wrap;html=1;fillColor=${fillColor};strokeColor=#6b7280;fontStyle=1;startSize=30;rounded=1;arcSize=8;`;
  
  return `
      <mxCell id="${cellId}" value="${label}" style="${style}" vertex="1" parent="1">
        <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" />
      </mxCell>`;
}

// Create draw.io mxCell for an Azure service node with embedded icon
async function createServiceCell(
  node: Node, 
  cellId: string, 
  parentCellId: string,
  groupNodeMap: Map<string, { cellId: string; x: number; y: number }>
): Promise<{ containerCell: string; iconCell: string | null }> {
  // Get position - if node has a parent group, position is relative to group
  let x = node.position?.x || 0;
  let y = node.position?.y || 0;
  
  // Adjust position for grouped nodes (make relative to group)
  if (node.parentNode && groupNodeMap.has(node.parentNode)) {
    // Position is already relative in React Flow, but we need to account for swimlane header
    y += 30; // Offset for swimlane header
  }
  
  const width = 140;
  const height = 90;
  const label = escapeXml(node.data?.label || 'Azure Service');
  const category = node.data?.category || '';
  const fillColor = getCategoryFillColor(category);
  const strokeColor = getCategoryStrokeColor(category);
  
  // Description/type for tooltip
  const description = node.data?.description || node.data?.type || '';
  const tooltip = description ? ` tooltip="${escapeXml(description)}"` : '';
  
  // Pricing info if available
  const pricing = node.data?.pricing;
  let pricingLabel = '';
  if (pricing && pricing.estimatedCost > 0) {
    const cost = pricing.estimatedCost * (pricing.quantity || 1);
    pricingLabel = `&#xa;$${cost.toFixed(2)}/mo`;
  }
  
  // Style for service node - rounded rectangle
  const style = `rounded=1;whiteSpace=wrap;html=1;fillColor=${fillColor};strokeColor=${strokeColor};strokeWidth=2;fontStyle=0;verticalAlign=bottom;spacingBottom=8;`;
  
  // Service cell XML
  const containerCell = `
      <mxCell id="${cellId}" value="${label}${pricingLabel}" style="${style}" vertex="1"${tooltip} parent="${parentCellId}">
        <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" />
      </mxCell>`;
  
  // Try to load and embed icon as Base64 - create as separate absolute-positioned cell
  const iconPath = node.data?.iconPath;
  console.log('[Draw.io Export] Node:', label, 'iconPath:', iconPath);
  
  let iconCell: string | null = null;
  
  if (iconPath) {
    const iconDataUri = await loadIconAsBase64(iconPath);
    if (iconDataUri) {
      console.log('[Draw.io Export] Icon embedded for:', label);
      
      const iconCellId = generateCellId();
      const iconSize = 48;
      const iconX = x + (width - iconSize) / 2; // Absolute center position
      const iconY = y + 8; // Absolute top padding
      
      // Draw.io image style - use raw data URI (they handle encoding internally)
      const iconStyle = `shape=image;imageAspect=0;aspect=fixed;verticalLabelPosition=bottom;labelBackgroundColor=default;verticalAlign=top;html=1;image=${iconDataUri};`;
      
      iconCell = `
      <mxCell id="${iconCellId}" value="" style="${iconStyle}" vertex="1" parent="${parentCellId}">
        <mxGeometry x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" as="geometry" />
      </mxCell>`;
    } else {
      console.warn('[Draw.io Export] Failed to load icon for:', label);
    }
  } else {
    console.log('[Draw.io Export] No icon path for node:', label);
  }
  
  return { containerCell, iconCell };
}

// Create draw.io mxCell for an edge/connection
function createEdgeCell(
  edge: Edge, 
  edgeCellId: string, 
  nodeIdToCellId: Map<string, string>
): string {
  const sourceCellId = nodeIdToCellId.get(edge.source);
  const targetCellId = nodeIdToCellId.get(edge.target);
  
  if (!sourceCellId || !targetCellId) {
    console.warn(`Edge ${edge.id} references missing nodes: ${edge.source} -> ${edge.target}`);
    return '';
  }
  
  const label = edge.data?.label || edge.label || '';
  const edgeType = edge.data?.connectionType || edge.type || 'sync';
  const dashStyle = getEdgeStyle(edgeType);
  
  // Edge style with smooth curves and boxed labels (like React Flow)
  // - edgeStyle=orthogonalEdgeStyle with curved=1 creates smooth rounded orthogonal paths
  // - labelBackgroundColor adds a white box behind the label
  // - labelBorderColor adds a border around the label box
  const labelBoxStyle = label 
    ? 'labelBackgroundColor=#fef9c3;labelBorderColor=#374151;spacingTop=2;spacingBottom=2;spacingLeft=6;spacingRight=6;fontSize=12;fontColor=#1f2937;fontStyle=1;' 
    : '';
  const style = `edgeStyle=orthogonalEdgeStyle;curved=1;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;${dashStyle}strokeWidth=2;strokeColor=#6b7280;endArrow=classic;endFill=1;${labelBoxStyle}`;
  
  const labelAttr = label ? ` value="${escapeXml(String(label))}"` : ' value=""';
  
  return `
      <mxCell id="${edgeCellId}"${labelAttr} style="${style}" edge="1" parent="1" source="${sourceCellId}" target="${targetCellId}">
        <mxGeometry relative="1" as="geometry" />
      </mxCell>`;
}

// Main export function (async to support icon embedding)
export async function exportToDrawio(
  nodes: Node[], 
  edges: Edge[], 
  diagramName: string = 'Azure Architecture'
): Promise<string> {
  resetCellIdCounter();
  
  // Maps to track cell IDs
  const nodeIdToCellId = new Map<string, string>();
  const groupNodeMap = new Map<string, { cellId: string; x: number; y: number }>();
  
  // Separate groups from service nodes
  const groupNodes = nodes.filter(n => n.type === 'groupNode');
  const serviceNodes = nodes.filter(n => n.type !== 'groupNode');
  
  // Generate cells for groups first
  const groupCells: string[] = [];
  for (const groupNode of groupNodes) {
    const cellId = generateCellId();
    nodeIdToCellId.set(groupNode.id, cellId);
    groupNodeMap.set(groupNode.id, { 
      cellId, 
      x: groupNode.position?.x || 0, 
      y: groupNode.position?.y || 0 
    });
    groupCells.push(createGroupCell(groupNode, cellId));
  }
  
  // Generate cells for service nodes (with async icon loading)
  const serviceCellPromises = serviceNodes.map(async (serviceNode) => {
    const cellId = generateCellId();
    nodeIdToCellId.set(serviceNode.id, cellId);
    
    // Determine parent - if node belongs to a group, use group's cell ID
    let parentCellId = '1'; // Default parent (layer)
    if (serviceNode.parentNode && groupNodeMap.has(serviceNode.parentNode)) {
      parentCellId = groupNodeMap.get(serviceNode.parentNode)!.cellId;
    }
    
    return await createServiceCell(serviceNode, cellId, parentCellId, groupNodeMap);
  });
  
  const serviceCellResults = await Promise.all(serviceCellPromises);
  
  // Separate container cells and icon cells
  const serviceCells: string[] = [];
  const iconCells: string[] = [];
  
  for (const result of serviceCellResults) {
    serviceCells.push(result.containerCell);
    if (result.iconCell) {
      iconCells.push(result.iconCell);
    }
  }
  
  // Generate cells for edges
  const edgeCells: string[] = [];
  for (const edge of edges) {
    const edgeCellId = generateCellId();
    const edgeCell = createEdgeCell(edge, edgeCellId, nodeIdToCellId);
    if (edgeCell) {
      edgeCells.push(edgeCell);
    }
  }
  
  // Combine all cells - put icons after services so they appear on top
  const allCells = [...groupCells, ...serviceCells, ...iconCells, ...edgeCells].join('');
  
  // Calculate diagram bounds for page size
  let maxX = 0, maxY = 0;
  for (const node of nodes) {
    const x = (node.position?.x || 0) + ((node as any).width || 400);
    const y = (node.position?.y || 0) + ((node as any).height || 300);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  
  // Add padding
  const pageWidth = Math.max(maxX + 100, 1200);
  const pageHeight = Math.max(maxY + 100, 800);
  
  // Build the full draw.io XML
  const drawioXml = `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="Azure Architecture Diagram Builder" version="1.0" type="device">
  <diagram id="azure-architecture" name="${escapeXml(diagramName)}">
    <mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${pageWidth}" pageHeight="${pageHeight}" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />${allCells}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
  
  return drawioXml;
}

// Download helper function
export function downloadDrawioFile(xml: string, fileName: string = 'azure-architecture.drawio'): void {
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Combined export and download (async)
export async function exportAndDownloadDrawio(
  nodes: Node[], 
  edges: Edge[], 
  diagramName?: string
): Promise<string> {
  const xml = await exportToDrawio(nodes, edges, diagramName);
  const fileName = generateModelFilename('azure-diagram', 'drawio');
  downloadDrawioFile(xml, fileName);
  return fileName;
}
