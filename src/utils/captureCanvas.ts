// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Diagram capture utility
 *
 * Wraps html-to-image to reliably capture the ReactFlow canvas — including
 * SVG edge paths (smooth / bezier / orthogonal curves, dashed stroke patterns,
 * etc.) that html2canvas would silently drop.
 *
 * Root-cause of edge invisibility with html-to-image:
 *   html-to-image serialises the DOM into an SVG <foreignObject> block.
 *   Inside that foreign object, the original page's CSS stylesheets are no
 *   longer in scope, so SVG <path> elements that relied on CSS class rules
 *   for their stroke colour (e.g. ReactFlow's sync edges) render as invisible.
 *
 * Fix: `prepareEdgesForCapture()` reads each SVG element's COMPUTED styles
 * (which DO include the CSS-derived values) and copies them as SVG presentation
 * attributes directly onto the elements just before capture.  Presentation
 * attributes survive serialisation regardless of whether stylesheets are
 * present.  After capture, all attributes are restored to their original state.
 */

import { toPng, toSvg } from 'html-to-image';
import { getNodesBounds, type Node } from 'reactflow';

export type ExportBackground = 'plain' | 'dots' | 'grid';

// ─── SVG edge pre-inlining ────────────────────────────────────────────────────

/** Presentation attributes we forcibly inline before capture. */
const SVG_ATTRS_TO_INLINE = [
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'fill',
  'fill-opacity',
  'opacity',
  'marker-end',
  'marker-start',
] as const;

/**
 * Copy computed CSS properties onto SVG path/line/polyline/circle elements as
 * presentation attributes.  Returns a cleanup function that restores the
 * original attribute state.
 */
function prepareEdgesForCapture(wrapper: HTMLElement): () => void {
  const restorers: Array<() => void> = [];

  wrapper
    .querySelectorAll<SVGElement>('svg path, svg line, svg polyline, svg circle')
    .forEach((el) => {
      const cs = window.getComputedStyle(el as unknown as Element);

      SVG_ATTRS_TO_INLINE.forEach((attr) => {
        // getComputedStyle uses camelCase for hyphenated properties
        const camel = attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) as
          keyof CSSStyleDeclaration;
        const computed = cs[camel] as string | undefined;
        if (!computed || computed === '') return;

        const prev = el.getAttribute(attr);

        // Normalise transparent fills → 'none' (SVG convention)
        const normalised =
          attr === 'fill' &&
          (computed === 'rgba(0, 0, 0, 0)' || computed === 'transparent')
            ? 'none'
            : computed;

        el.setAttribute(attr, normalised);

        restorers.push(() => {
          if (prev === null) el.removeAttribute(attr);
          else el.setAttribute(attr, prev);
        });
      });
    });

  return () => restorers.forEach((fn) => fn());
}

// ─── Classes that should always be hidden from captured output ────────────────

const UI_CHROME_CLASSES = [
  'react-flow__minimap',
  'react-flow__controls',
  'react-flow__attribution',
  // Transient guidance and controls in the bottom dock are never part of a diagram.
  'canvas-layout-hint',
  'prompt-banner-toggle',
];

/** Extended set used for SVG/PPTX export (hides floating panels too). */
const PANEL_CLASSES = [
  ...UI_CHROME_CLASSES,
  'info-panel',
  'workflow-panel',
  'alignment-toolbar',
  'icon-palette',
  'canvas-nav-hint',
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaptureOptions {
  /** CSS color string for the background (any valid CSS value). */
  backgroundColor: string;
  /**
   * Output pixel ratio (default 2 for @2x / retina quality).
   * Uses the actual device pixel ratio when omitted.
   */
  pixelRatio?: number;
  /**
   * When true, also hide floating info/workflow/palette panels
   * in addition to the standard ReactFlow chrome. Useful for
   * "clean" exports (SVG, PPTX) where UI panels would be noise.
   */
  excludePanels?: boolean;
  /**
   * Background pattern for the exported artifact. The live React Flow canvas
   * remains dotted; this controls only the cloned capture output.
   * Defaults to `plain` for presentation-ready exports.
   */
  exportBackground?: ExportBackground;
  /**
   * The diagram's nodes. When given, only the diagram itself is rendered, at
   * its natural size, cropped to its bounds — not the on-screen canvas with
   * its toolbar, dock and empty margins, which left the diagram tiny in exports.
   */
  nodes?: Node[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function makeFilter(excludeClasses: string[]) {
  return (node: HTMLElement): boolean => {
    if (!node.classList) return true;
    return !excludeClasses.some((cls) => node.classList.contains(cls));
  };
}

function captureStyle(exportBackground: ExportBackground): Partial<CSSStyleDeclaration> {
  if (exportBackground === 'dots') {
    // The React Flow background layer sits outside the cropped viewport, so
    // draw the dots on the captured element itself.
    return {
      backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.45) 1px, transparent 1px)',
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0',
    };
  }
  if (exportBackground !== 'grid') return {};
  return {
    backgroundImage: [
      'linear-gradient(rgba(96, 165, 250, 0.24) 1px, transparent 1px)',
      'linear-gradient(90deg, rgba(96, 165, 250, 0.24) 1px, transparent 1px)',
    ].join(', '),
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0',
  };
}

function captureClasses(options: CaptureOptions): string[] {
  const classes = options.excludePanels ? [...PANEL_CLASSES] : [...UI_CHROME_CLASSES];
  if ((options.exportBackground ?? 'plain') !== 'dots') {
    classes.push('react-flow__background');
  }
  return classes;
}

// Room around the node bounds for edge labels and routed edges that bend
// outside the outermost nodes.
const DIAGRAM_MARGIN = 64;
// Small diagrams are upscaled to at least this many pixels on the long side;
// large ones are capped so the browser can still allocate the canvas.
const MIN_LONG_SIDE_PX = 2400;
const MAX_LONG_SIDE_PX = 8000;

interface CaptureTarget {
  element: HTMLElement;
  width?: number;
  height?: number;
  pixelRatio: number;
  style: Partial<CSSStyleDeclaration>;
}

/**
 * Work out what to render: the diagram layer cropped to the nodes' bounds at
 * zoom 1 when nodes are given, otherwise the whole element as shown on screen.
 */
function captureTarget(element: HTMLElement, options: CaptureOptions): CaptureTarget {
  const background = captureStyle(options.exportBackground ?? 'plain');
  const nodes = (options.nodes ?? []).filter((node) => !node.hidden);
  const viewport = element.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport || nodes.length === 0) {
    return { element, pixelRatio: options.pixelRatio ?? 2, style: background };
  }
  const bounds = getNodesBounds(nodes);
  const width = Math.ceil(bounds.width + DIAGRAM_MARGIN * 2);
  const height = Math.ceil(bounds.height + DIAGRAM_MARGIN * 2);
  const longSide = Math.max(width, height);
  const pixelRatio = options.pixelRatio
    ?? Math.min(Math.max(2, MIN_LONG_SIDE_PX / longSide), MAX_LONG_SIDE_PX / longSide);
  return {
    element: viewport,
    width,
    height,
    pixelRatio,
    style: {
      ...background,
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${DIAGRAM_MARGIN - bounds.x}px, ${DIAGRAM_MARGIN - bounds.y}px) scale(1)`,
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Capture the element as a PNG and return a `data:image/png` data URL.
 *
 * SVG edge styles are pre-inlined as presentation attributes so they survive
 * the html-to-image foreignObject serialisation.
 */
export async function captureDiagramAsPng(
  element: HTMLElement,
  options: CaptureOptions,
): Promise<string> {
  const excludeClasses = captureClasses(options);
  const target = captureTarget(element, options);
  const restore = prepareEdgesForCapture(element);

  try {
    return await toPng(target.element, {
      backgroundColor: options.backgroundColor,
      pixelRatio: target.pixelRatio,
      width: target.width,
      height: target.height,
      filter: makeFilter(excludeClasses),
      style: target.style,
      imagePlaceholder:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });
  } finally {
    restore();
  }
}

/**
 * Capture the element as a native SVG text string.
 *
 * SVG edge styles are pre-inlined so paths are visible in the output.
 * Returns decoded SVG text (ready for `new Blob([...])`).
 */
export async function captureDiagramAsSvg(
  element: HTMLElement,
  options: CaptureOptions,
): Promise<string> {
  const excludeClasses = captureClasses(options);
  const target = captureTarget(element, options);
  const restore = prepareEdgesForCapture(element);

  try {
    const dataUrl = await toSvg(target.element, {
      backgroundColor: options.backgroundColor,
      pixelRatio: target.pixelRatio,
      width: target.width,
      height: target.height,
      filter: makeFilter(excludeClasses),
      style: target.style,
      imagePlaceholder:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });
    // dataUrl: "data:image/svg+xml;charset=utf-8,<url-encoded-svg>"
    const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return decodeURIComponent(encoded);
  } finally {
    restore();
  }
}

