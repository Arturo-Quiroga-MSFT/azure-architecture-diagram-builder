// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Visio VDX Exporter
 * ------------------
 * Generates a self-contained legacy Visio XML drawing (.vdx — DatadiagramML,
 * the "Visio 2003-2013 core" schema) from the React Flow diagram. Visio can
 * open .vdx directly via File > Open, giving editable native shapes and
 * connectors — no add-in, no conversion step.
 *
 * This is the "low-risk, self-contained" Visio path: a single XML file whose
 * well-formedness we can validate without desktop Visio. It intentionally keeps
 * shapes generic (labeled rectangles + straight glued connectors) rather than
 * mapping to Azure master stencils, which is a larger follow-up.
 *
 * Coordinate model: React Flow uses top-left origin in pixels (Y down); Visio
 * uses bottom-left origin in inches (Y up). We convert with 96 px/inch and flip
 * Y against the computed page height.
 */

import type { Node, Edge } from 'reactflow';

const PX_PER_INCH = 96;
const DEFAULT_NODE_W = 150;
const DEFAULT_NODE_H = 75;
const PAGE_PADDING_PX = 120;

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const inches = (px: number) => +(px / PX_PER_INCH).toFixed(4);

interface Box {
  /** Absolute top-left in px. */
  x: number;
  y: number;
  w: number;
  h: number;
}

function nodeSize(n: Node): { w: number; h: number } {
  const anyN = n as any;
  const styleW = typeof anyN.style?.width === 'number' ? anyN.style.width : undefined;
  const styleH = typeof anyN.style?.height === 'number' ? anyN.style.height : undefined;
  if (n.type === 'groupNode') {
    return { w: styleW ?? anyN.width ?? 400, h: styleH ?? anyN.height ?? 300 };
  }
  return { w: anyN.width ?? styleW ?? DEFAULT_NODE_W, h: anyN.height ?? styleH ?? DEFAULT_NODE_H };
}

/**
 * Build a Visio .vdx (DatadiagramML) document string for the diagram.
 */
export function buildVdx(nodes: Node[], edges: Edge[], diagramName = 'Azure Architecture'): string {
  const groupNodes = nodes.filter((n) => n.type === 'groupNode');
  const serviceNodes = nodes.filter((n) => n.type !== 'groupNode');

  // Absolute top-left px for every node (grouped services are offset by parent).
  const groupPos = new Map<string, { x: number; y: number }>();
  for (const g of groupNodes) groupPos.set(g.id, { x: g.position?.x ?? 0, y: g.position?.y ?? 0 });

  const boxes = new Map<string, Box>();
  for (const n of nodes) {
    const { w, h } = nodeSize(n);
    let x = n.position?.x ?? 0;
    let y = n.position?.y ?? 0;
    if (n.type !== 'groupNode' && n.parentNode && groupPos.has(n.parentNode)) {
      const p = groupPos.get(n.parentNode)!;
      x += p.x;
      y += p.y;
    }
    boxes.set(n.id, { x, y, w, h });
  }

  // Page bounds → height needed for the Y flip.
  let maxX = 0;
  let maxY = 0;
  for (const b of boxes.values()) {
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  const pageWidthIn = inches(Math.max(maxX + PAGE_PADDING_PX, 800));
  const pageHeightIn = inches(Math.max(maxY + PAGE_PADDING_PX, 600));

  // Visio center (PinX/PinY) in inches, Y flipped.
  const centerIn = (b: Box) => {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    return { pinX: inches(cx), pinY: +(pageHeightIn - inches(cy)).toFixed(4) };
  };

  // Stable Visio shape IDs (1-based). Track per node id.
  const shapeId = new Map<string, number>();
  let nextId = 1;
  for (const g of groupNodes) shapeId.set(g.id, nextId++);
  for (const s of serviceNodes) shapeId.set(s.id, nextId++);

  const shapeXml: string[] = [];

  // ── Group rectangles (drawn first, behind) ─────────────────────────────
  for (const g of groupNodes) {
    const b = boxes.get(g.id)!;
    const { pinX, pinY } = centerIn(b);
    const wIn = inches(b.w);
    const hIn = inches(b.h);
    const label = esc(String((g.data as any)?.label ?? 'Group'));
    shapeXml.push(rectShape(shapeId.get(g.id)!, pinX, pinY, wIn, hIn, label, '#EEF3FB', '#8AA9D6', true));
  }

  // ── Service rectangles ──────────────────────────────────────────────────
  for (const s of serviceNodes) {
    const b = boxes.get(s.id)!;
    const { pinX, pinY } = centerIn(b);
    const wIn = inches(b.w);
    const hIn = inches(b.h);
    const label = esc(String((s.data as any)?.label ?? 'Service'));
    shapeXml.push(rectShape(shapeId.get(s.id)!, pinX, pinY, wIn, hIn, label, '#FFFFFF', '#0078D4', false));
  }

  // ── Connectors (1-D shapes, glued to endpoints) ─────────────────────────
  const connectXml: string[] = [];
  for (const e of edges) {
    const sId = shapeId.get(e.source);
    const tId = shapeId.get(e.target);
    const sBox = boxes.get(e.source);
    const tBox = boxes.get(e.target);
    if (!sId || !tId || !sBox || !tBox) continue;

    const cid = nextId++;
    const s = centerIn(sBox);
    const t = centerIn(tBox);
    const label = typeof e.label === 'string' ? esc(e.label) : '';
    shapeXml.push(connectorShape(cid, s.pinX, s.pinY, t.pinX, t.pinY, label));
    connectXml.push(
      `        <Connect FromSheet="${cid}" FromCell="BeginX" ToSheet="${sId}" ToCell="PinX" ToPart="3"/>`,
    );
    connectXml.push(
      `        <Connect FromSheet="${cid}" FromCell="EndX" ToSheet="${tId}" ToCell="PinX" ToPart="3"/>`,
    );
  }

  const connectsBlock = connectXml.length
    ? `\n      <Connects>\n${connectXml.join('\n')}\n      </Connects>`
    : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<VisioDocument xmlns="http://schemas.microsoft.com/visio/2003/core">
  <DocumentProperties>
    <Title>${esc(diagramName)}</Title>
    <Creator>Azure Architecture Diagram Builder</Creator>
  </DocumentProperties>
  <Pages>
    <Page ID="0" Name="${esc(diagramName)}" ViewScale="-1" ViewCenterX="${(pageWidthIn / 2).toFixed(4)}" ViewCenterY="${(pageHeightIn / 2).toFixed(4)}">
      <PageSheet>
        <PageProps>
          <PageWidth>${pageWidthIn}</PageWidth>
          <PageHeight>${pageHeightIn}</PageHeight>
          <ShdwOffsetX>0.1</ShdwOffsetX>
          <ShdwOffsetY>-0.1</ShdwOffsetY>
        </PageProps>
      </PageSheet>
      <Shapes>
${shapeXml.join('\n')}
      </Shapes>${connectsBlock}
    </Page>
  </Pages>
</VisioDocument>
`;
}

/** A rectangle shape with centered text. */
function rectShape(
  id: number,
  pinX: number,
  pinY: number,
  w: number,
  h: number,
  text: string,
  fill: string,
  line: string,
  isGroupBg: boolean,
): string {
  return `        <Shape ID="${id}" Type="Shape">
          <XForm>
            <PinX>${pinX}</PinX>
            <PinY>${pinY}</PinY>
            <Width>${w}</Width>
            <Height>${h}</Height>
            <LocPinX>${(w / 2).toFixed(4)}</LocPinX>
            <LocPinY>${(h / 2).toFixed(4)}</LocPinY>
          </XForm>
          <Fill>
            <FillForegnd>${fill}</FillForegnd>
            <FillPattern>1</FillPattern>
          </Fill>
          <Line>
            <LineColor>${line}</LineColor>
            <LineWeight>0.013</LineWeight>
            <Rounding>${isGroupBg ? 0.06 : 0.03}</Rounding>
          </Line>
          <Geom IX="0">
            <NoFill>0</NoFill>
            <NoLine>0</NoLine>
            <MoveTo IX="1"><X>0</X><Y>0</Y></MoveTo>
            <LineTo IX="2"><X>${w}</X><Y>0</Y></LineTo>
            <LineTo IX="3"><X>${w}</X><Y>${h}</Y></LineTo>
            <LineTo IX="4"><X>0</X><Y>${h}</Y></LineTo>
            <LineTo IX="5"><X>0</X><Y>0</Y></LineTo>
          </Geom>
          <Text>${text}</Text>
        </Shape>`;
}

/** A straight 1-D connector between two page points, with an arrowhead. */
function connectorShape(
  id: number,
  beginX: number,
  beginY: number,
  endX: number,
  endY: number,
  label: string,
): string {
  const dx = +(endX - beginX).toFixed(4);
  const dy = +(endY - beginY).toFixed(4);
  const width = +Math.hypot(dx, dy).toFixed(4) || 0.0001;
  const pinX = +((beginX + endX) / 2).toFixed(4);
  const pinY = +((beginY + endY) / 2).toFixed(4);
  return `        <Shape ID="${id}" Type="Shape">
          <XForm>
            <PinX>${pinX}</PinX>
            <PinY>${pinY}</PinY>
            <Width>${width}</Width>
            <Height>0</Height>
            <LocPinX>${(width / 2).toFixed(4)}</LocPinX>
            <LocPinY>0</LocPinY>
            <Angle>0</Angle>
          </XForm>
          <XForm1D>
            <BeginX>${beginX}</BeginX>
            <BeginY>${beginY}</BeginY>
            <EndX>${endX}</EndX>
            <EndY>${endY}</EndY>
          </XForm1D>
          <Line>
            <LineColor>#0078D4</LineColor>
            <LineWeight>0.013</LineWeight>
            <EndArrow>4</EndArrow>
          </Line>
          <Geom IX="0">
            <NoFill>1</NoFill>
            <NoLine>0</NoLine>
            <MoveTo IX="1"><X>0</X><Y>0</Y></MoveTo>
            <LineTo IX="2"><X>${width}</X><Y>0</Y></LineTo>
          </Geom>
          <Text>${label}</Text>
        </Shape>`;
}
