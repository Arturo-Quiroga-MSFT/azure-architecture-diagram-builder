// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Visio VSDX Exporter
 * -------------------
 * Generates a native Visio drawing (.vsdx) — the modern Open Packaging
 * Conventions (OPC) format that opens directly in BOTH desktop Visio and
 * Visio for the web, and can also be imported by diagrams.net.
 *
 * A .vsdx is a ZIP package of XML parts (2012 Visio schema). We assemble the
 * minimal set Visio requires:
 *   [Content_Types].xml
 *   _rels/.rels
 *   docProps/core.xml, docProps/app.xml
 *   visio/document.xml            (DocumentSettings, Colors, FaceNames, StyleSheets)
 *   visio/_rels/document.xml.rels (-> pages, windows)
 *   visio/windows.xml
 *   visio/pages/pages.xml         (Page + PageSheet, -> page1)
 *   visio/pages/_rels/pages.xml.rels
 *   visio/pages/page1.xml         (Shapes + Connects)
 *
 * Shape model: services/groups → rectangles (Geometry section, local inch
 * coords); edges → straight 1-D connectors glued to endpoints via Connects.
 * Coordinates convert React Flow px/top-left (Y down) → Visio inches/bottom-left
 * (Y up) at 96 px/inch.
 *
 * Generic shapes only (no Azure master stencils yet — a follow-up).
 */

import JSZip from 'jszip';
import type { Node, Edge } from 'reactflow';
import { loadIcon } from '../utils/iconLoader';

const PX_PER_INCH = 96;
const DEFAULT_NODE_W = 150;
const DEFAULT_NODE_H = 75;
const PAGE_PADDING_PX = 120;

const VISIO_NS = 'http://schemas.microsoft.com/office/visio/2012/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const inches = (px: number) => +(px / PX_PER_INCH).toFixed(4);
const f = (n: number) => +n.toFixed(4);

interface Box { x: number; y: number; w: number; h: number }

function nodeSize(n: Node): { w: number; h: number } {
  const anyN = n as any;
  const styleW = typeof anyN.style?.width === 'number' ? anyN.style.width : undefined;
  const styleH = typeof anyN.style?.height === 'number' ? anyN.style.height : undefined;
  if (n.type === 'groupNode') {
    return { w: styleW ?? anyN.width ?? 400, h: styleH ?? anyN.height ?? 300 };
  }
  return { w: anyN.width ?? styleW ?? DEFAULT_NODE_W, h: anyN.height ?? styleH ?? DEFAULT_NODE_H };
}

// ── OPC static parts ────────────────────────────────────────────────────

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/>
  <Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>
  <Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/>
  <Override PartName="/visio/windows.xml" ContentType="application/vnd.ms-visio.windows+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const DOCUMENT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/>
  <Relationship Id="rId2" Type="http://schemas.microsoft.com/visio/2010/relationships/windows" Target="windows.xml"/>
</Relationships>`;

const PAGES_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/>
</Relationships>`;

const WINDOWS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Windows xmlns="${VISIO_NS}" xmlns:r="${REL_NS}" ClientWidth="1000" ClientHeight="600">
  <Window ID="0" WindowType="Drawing" WindowState="1073741824" WindowLeft="0" WindowTop="0" WindowWidth="1000" WindowHeight="600" ContainerType="Page" Page="0" ViewScale="1" ViewCenterX="5.5" ViewCenterY="4.25"/>
</Windows>`;

// document.xml — minimal DocumentSettings + a single "No Style" stylesheet (ID 0)
// referenced by pages and shapes. Visio requires style sheet 0 to exist.
const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<VisioDocument xmlns="${VISIO_NS}" xmlns:r="${REL_NS}">
  <DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0">
    <GlueSettings>9</GlueSettings>
    <SnapSettings>65847</SnapSettings>
    <SnapExtensions>34</SnapExtensions>
    <DynamicGridEnabled>1</DynamicGridEnabled>
    <ProtectStyles>0</ProtectStyles>
    <ProtectShapes>0</ProtectShapes>
    <ProtectMasters>0</ProtectMasters>
    <ProtectBkgnds>0</ProtectBkgnds>
  </DocumentSettings>
  <StyleSheets>
    <StyleSheet ID="0" NameU="No Style" Name="No Style">
      <Cell N="EnableLineProps" V="1"/>
      <Cell N="EnableFillProps" V="1"/>
      <Cell N="EnableTextProps" V="1"/>
      <Cell N="LineWeight" V="0.01041666666666667"/>
      <Cell N="LineColor" V="0"/>
      <Cell N="LinePattern" V="1"/>
      <Cell N="FillForegnd" V="1"/>
      <Cell N="FillPattern" V="1"/>
      <Cell N="TextBkgnd" V="0"/>
    </StyleSheet>
  </StyleSheets>
</VisioDocument>`;

function coreXml(title: string): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${esc(title)}</dc:title>
  <dc:creator>Azure Architecture Diagram Builder</dc:creator>
  <cp:lastModifiedBy>Azure Architecture Diagram Builder</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

const APP_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Visio</Application>
  <AppVersion>16.0000</AppVersion>
</Properties>`;

// ── Shape / page builders ─────────────────────────────────────────────────

function rectShapeXml(id: number, pinX: number, pinY: number, w: number, h: number, text: string, fill: string, line: string, opts: { titleTop?: boolean; vAlignBottom?: boolean } = {}): string {
  // Group boxes: title at top-left, bold — like a zone header. Shapes with an
  // icon overlay use bottom-aligned text so it sits below the icon.
  const alignCells = opts.titleTop
    ? `
      <Cell N="VerticalAlign" V="0"/>
      <Cell N="TopMargin" V="0.06"/>
      <Cell N="LeftMargin" V="0.1"/>`
    : opts.vAlignBottom
      ? `
      <Cell N="VerticalAlign" V="2"/>
      <Cell N="BottomMargin" V="0.03"/>`
      : '';
  const textSections = opts.titleTop
    ? `
      <Section N="Character"><Row IX="0"><Cell N="Size" V="0.13"/><Cell N="Style" V="1"/></Row></Section>
      <Section N="Paragraph"><Row IX="0"><Cell N="HorzAlign" V="0"/></Row></Section>`
    : opts.vAlignBottom
      ? `
      <Section N="Character"><Row IX="0"><Cell N="Size" V="0.09"/></Row></Section>`
      : '';
  return `    <Shape ID="${id}" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">
      <Cell N="PinX" V="${f(pinX)}"/>
      <Cell N="PinY" V="${f(pinY)}"/>
      <Cell N="Width" V="${f(w)}"/>
      <Cell N="Height" V="${f(h)}"/>
      <Cell N="LocPinX" V="${f(w / 2)}"/>
      <Cell N="LocPinY" V="${f(h / 2)}"/>
      <Cell N="Angle" V="0"/>
      <Cell N="FillForegnd" V="${fill}"/>
      <Cell N="FillPattern" V="1"/>
      <Cell N="LineColor" V="${line}"/>
      <Cell N="LineWeight" V="0.01"/>${alignCells}
      <Section N="Geometry" IX="0">
        <Cell N="NoFill" V="0"/>
        <Cell N="NoLine" V="0"/>
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="${f(w)}"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="3"><Cell N="X" V="${f(w)}"/><Cell N="Y" V="${f(h)}"/></Row>
        <Row T="LineTo" IX="4"><Cell N="X" V="0"/><Cell N="Y" V="${f(h)}"/></Row>
        <Row T="LineTo" IX="5"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
      </Section>${textSections}
      <Text>${text}</Text>
    </Shape>`;
}

/** A Foreign (embedded bitmap) shape referencing a media image relationship. */
function iconShapeXml(id: number, pinX: number, pinY: number, size: number, relId: string): string {
  return `    <Shape ID="${id}" Type="Foreign" LineStyle="0" FillStyle="0" TextStyle="0">
      <Cell N="PinX" V="${f(pinX)}"/>
      <Cell N="PinY" V="${f(pinY)}"/>
      <Cell N="Width" V="${f(size)}"/>
      <Cell N="Height" V="${f(size)}"/>
      <Cell N="LocPinX" V="${f(size / 2)}"/>
      <Cell N="LocPinY" V="${f(size / 2)}"/>
      <Cell N="Angle" V="0"/>
      <Cell N="ImgOffsetX" V="0"/>
      <Cell N="ImgOffsetY" V="0"/>
      <Cell N="ImgWidth" V="${f(size)}"/>
      <Cell N="ImgHeight" V="${f(size)}"/>
      <ForeignData ForeignType="Bitmap" CompressionType="PNG">
        <Rel r:id="${relId}"/>
      </ForeignData>
    </Shape>`;
}

/**
 * Rasterize an SVG icon (fetched from iconPath) to PNG bytes via an offscreen
 * canvas. Browser-only; returns null on any failure so the caller falls back to
 * a plain rectangle.
 */
async function rasterizeSvgToPng(iconPath: string, sizePx = 96): Promise<Uint8Array | null> {
  try {
    const res = await fetch(iconPath);
    if (!res.ok) return null;
    let svg = await res.text();
    // Many Azure icon SVGs declare only a viewBox (no width/height). Without
    // explicit pixel dimensions some browsers rasterize a 0-sized (blank)
    // image, so inject width/height on the root <svg> when missing.
    if (!/<svg[^>]*\bwidth\s*=/.test(svg)) {
      svg = svg.replace(/<svg\b/, `<svg width="${sizePx}" height="${sizePx}"`);
    }
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('icon image load failed'));
      img.src = svgUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = sizePx;
    canvas.height = sizePx;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, sizePx, sizePx);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Orthogonal connector: a 2-D polyline through right-angle waypoints (page-inch
 * points). Drawn with absolute local geometry (no rotation) so multi-segment
 * routes render correctly. Arrowhead on the final point.
 */
function orthConnectorXml(id: number, pts: Array<[number, number]>): string {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = f(Math.max(maxX - minX, 0.0001));
  const h = f(Math.max(maxY - minY, 0.0001));
  const rows = pts
    .map(
      (p, i) =>
        `        <Row T="${i === 0 ? 'MoveTo' : 'LineTo'}" IX="${i + 1}"><Cell N="X" V="${f(p[0] - minX)}"/><Cell N="Y" V="${f(p[1] - minY)}"/></Row>`,
    )
    .join('\n');
  return `    <Shape ID="${id}" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">
      <Cell N="PinX" V="${f(minX + (maxX - minX) / 2)}"/>
      <Cell N="PinY" V="${f(minY + (maxY - minY) / 2)}"/>
      <Cell N="Width" V="${w}"/>
      <Cell N="Height" V="${h}"/>
      <Cell N="LocPinX" V="${f(w / 2)}"/>
      <Cell N="LocPinY" V="${f(h / 2)}"/>
      <Cell N="Angle" V="0"/>
      <Cell N="LineColor" V="#6B7280"/>
      <Cell N="LineWeight" V="0.01"/>
      <Cell N="EndArrow" V="4"/>
      <Section N="Geometry" IX="0">
        <Cell N="NoFill" V="1"/>
        <Cell N="NoLine" V="0"/>
${rows}
      </Section>
    </Shape>`;
}

/**
 * Edge label chip: a boxed, wrapped, distinctly-colored text shape placed at the
 * connector's elbow — mirrors the app's yellow label chips. Text wraps within
 * the fixed width; label text color differs from the (blue/black) shapes.
 */
function labelShapeXml(id: number, cx: number, cy: number, text: string): string {
  const width = 1.7;
  const perLine = 24; // approx chars per line at this width/size
  const lines = Math.max(1, Math.ceil(text.length / perLine));
  const height = +(lines * 0.17 + 0.1).toFixed(2);
  return `    <Shape ID="${id}" Type="Shape" LineStyle="0" FillStyle="0" TextStyle="0">
      <Cell N="PinX" V="${f(cx)}"/>
      <Cell N="PinY" V="${f(cy)}"/>
      <Cell N="Width" V="${width}"/>
      <Cell N="Height" V="${height}"/>
      <Cell N="LocPinX" V="${f(width / 2)}"/>
      <Cell N="LocPinY" V="${f(height / 2)}"/>
      <Cell N="Angle" V="0"/>
      <Cell N="FillForegnd" V="#FEF9C3"/>
      <Cell N="FillPattern" V="1"/>
      <Cell N="LineColor" V="#9CA3AF"/>
      <Cell N="LineWeight" V="0.005"/>
      <Section N="Geometry" IX="0">
        <Cell N="NoFill" V="0"/>
        <Cell N="NoLine" V="0"/>
        <Row T="MoveTo" IX="1"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="2"><Cell N="X" V="${width}"/><Cell N="Y" V="0"/></Row>
        <Row T="LineTo" IX="3"><Cell N="X" V="${width}"/><Cell N="Y" V="${height}"/></Row>
        <Row T="LineTo" IX="4"><Cell N="X" V="0"/><Cell N="Y" V="${height}"/></Row>
        <Row T="LineTo" IX="5"><Cell N="X" V="0"/><Cell N="Y" V="0"/></Row>
      </Section>
      <Section N="Character">
        <Row IX="0"><Cell N="Color" V="#B45309"/><Cell N="Size" V="0.1"/></Row>
      </Section>
      <Section N="Paragraph">
        <Row IX="0"><Cell N="HorzAlign" V="1"/></Row>
      </Section>
      <Text>${text}</Text>
    </Shape>`;
}

function pagesXml(pageWidthIn: number, pageHeightIn: number, title: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Pages xmlns="${VISIO_NS}" xmlns:r="${REL_NS}">
  <Page ID="0" NameU="${esc(title)}" Name="${esc(title)}" ViewScale="1" ViewCenterX="${f(pageWidthIn / 2)}" ViewCenterY="${f(pageHeightIn / 2)}">
    <PageSheet LineStyle="0" FillStyle="0" TextStyle="0">
      <Cell N="PageWidth" V="${f(pageWidthIn)}"/>
      <Cell N="PageHeight" V="${f(pageHeightIn)}"/>
      <Cell N="ShdwOffsetX" V="0.125"/>
      <Cell N="ShdwOffsetY" V="-0.125"/>
      <Cell N="PageScale" V="1"/>
      <Cell N="DrawingScale" V="1"/>
      <Cell N="DrawingScaleType" V="0"/>
    </PageSheet>
    <Rel r:id="rId1"/>
  </Page>
</Pages>`;
}

function pageContentsXml(shapes: string[], connects: string[]): string {
  const connectsBlock = connects.length ? `\n  <Connects>\n${connects.join('\n')}\n  </Connects>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="${VISIO_NS}" xmlns:r="${REL_NS}">
  <Shapes>
${shapes.join('\n')}
  </Shapes>${connectsBlock}
</PageContents>`;
}

/**
 * Build a .vsdx package for the diagram and return it as a Blob.
 */
export async function buildVsdxBlob(nodes: Node[], edges: Edge[], diagramName = 'Azure Architecture'): Promise<Blob> {
  const groupNodes = nodes.filter((n) => n.type === 'groupNode');
  const serviceNodes = nodes.filter((n) => n.type !== 'groupNode');

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

  let maxX = 0;
  let maxY = 0;
  for (const b of boxes.values()) {
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  const pageWidthIn = inches(Math.max(maxX + PAGE_PADDING_PX, 800));
  const pageHeightIn = inches(Math.max(maxY + PAGE_PADDING_PX, 600));

  const centerIn = (b: Box) => {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    return { pinX: inches(cx), pinY: f(pageHeightIn - inches(cy)) };
  };

  const shapeId = new Map<string, number>();
  let nextId = 1;
  for (const g of groupNodes) shapeId.set(g.id, nextId++);
  for (const s of serviceNodes) shapeId.set(s.id, nextId++);

  const shapes: string[] = [];
  const media: Array<{ file: string; bytes: Uint8Array }> = [];
  const pageRels: string[] = [];
  let imgIdx = 0;

  // Group rectangles first (behind), title at top.
  for (const g of groupNodes) {
    const b = boxes.get(g.id)!;
    const { pinX, pinY } = centerIn(b);
    shapes.push(rectShapeXml(shapeId.get(g.id)!, pinX, pinY, inches(b.w), inches(b.h), esc(String((g.data as any)?.label ?? 'Group')), '#EEF3FB', '#8AA9D6', { titleTop: true }));
  }

  // Service rectangles, with the Azure icon rasterized + embedded on top.
  for (const s of serviceNodes) {
    const b = boxes.get(s.id)!;
    const { pinX, pinY } = centerIn(b);
    const wIn = inches(b.w);
    const hIn = inches(b.h);
    const label = esc(String((s.data as any)?.label ?? 'Service'));
    const iconPath = (s.data as any)?.iconPath as string | undefined;

    let png: Uint8Array | null = null;
    if (iconPath) {
      const url = await loadIcon(iconPath);
      if (url) png = await rasterizeSvgToPng(url);
    }

    if (png) {
      // Rectangle with text pushed to the bottom, icon centered in the top area.
      shapes.push(rectShapeXml(shapeId.get(s.id)!, pinX, pinY, wIn, hIn, label, '#FFFFFF', '#0078D4', { vAlignBottom: true }));
      imgIdx += 1;
      const file = `image${imgIdx}.png`;
      const relId = `rId${imgIdx}`;
      media.push({ file, bytes: png });
      pageRels.push(`  <Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${file}"/>`);
      const iconSize = Math.min(hIn * 0.55, wIn * 0.4, 0.42);
      const iconPinX = pinX;
      const iconPinY = pinY + hIn / 2 - iconSize / 2 - 0.05;
      shapes.push(iconShapeXml(nextId++, iconPinX, iconPinY, iconSize, relId));
    } else {
      shapes.push(rectShapeXml(shapeId.get(s.id)!, pinX, pinY, wIn, hIn, label, '#FFFFFF', '#0078D4'));
    }
  }

  // Connectors — orthogonal (right-angle) routes + boxed wrapped labels.
  for (const e of edges) {
    const sBox = boxes.get(e.source);
    const tBox = boxes.get(e.target);
    if (!sBox || !tBox) continue;
    const s = centerIn(sBox);
    const t = centerIn(tBox);

    // Right-angle "Z" route: bend at the horizontal midpoint for horizontal-
    // dominant flows, else at the vertical midpoint. Label sits on the middle
    // (elbow) segment so it stays clear of the shapes.
    let pts: Array<[number, number]>;
    let lcx: number;
    let lcy: number;
    if (Math.abs(t.pinX - s.pinX) >= Math.abs(t.pinY - s.pinY)) {
      const midX = (s.pinX + t.pinX) / 2;
      pts = [[s.pinX, s.pinY], [midX, s.pinY], [midX, t.pinY], [t.pinX, t.pinY]];
      lcx = midX;
      lcy = (s.pinY + t.pinY) / 2;
    } else {
      const midY = (s.pinY + t.pinY) / 2;
      pts = [[s.pinX, s.pinY], [s.pinX, midY], [t.pinX, midY], [t.pinX, t.pinY]];
      lcx = (s.pinX + t.pinX) / 2;
      lcy = midY;
    }

    shapes.push(orthConnectorXml(nextId++, pts));
    const label = typeof e.label === 'string' ? esc(e.label) : '';
    if (label) shapes.push(labelShapeXml(nextId++, lcx, lcy, label));
  }

  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('_rels/.rels', ROOT_RELS);
  zip.file('docProps/core.xml', coreXml(diagramName));
  zip.file('docProps/app.xml', APP_XML);
  zip.file('visio/document.xml', DOCUMENT_XML);
  zip.file('visio/_rels/document.xml.rels', DOCUMENT_RELS);
  zip.file('visio/windows.xml', WINDOWS_XML);
  zip.file('visio/pages/pages.xml', pagesXml(pageWidthIn, pageHeightIn, diagramName));
  zip.file('visio/pages/_rels/pages.xml.rels', PAGES_RELS);
  zip.file('visio/pages/page1.xml', pageContentsXml(shapes, []));

  // Embedded icon images + the page's relationships to them.
  if (media.length > 0) {
    zip.file(
      'visio/pages/_rels/page1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n${pageRels.join('\n')}\n</Relationships>`,
    );
    for (const mf of media) zip.file(`visio/media/${mf.file}`, mf.bytes);
  }

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.ms-visio.drawing',
    compression: 'DEFLATE',
  });
}
