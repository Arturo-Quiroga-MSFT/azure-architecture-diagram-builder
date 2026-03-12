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
];

/** Extended set used for SVG/PPTX export (hides floating panels too). */
const PANEL_CLASSES = [
  ...UI_CHROME_CLASSES,
  'info-panel',
  'workflow-panel',
  'alignment-toolbar',
  'icon-palette',
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
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function makeFilter(excludeClasses: string[]) {
  return (node: HTMLElement): boolean => {
    if (!node.classList) return true;
    return !excludeClasses.some((cls) => node.classList.contains(cls));
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
  const excludeClasses = options.excludePanels ? PANEL_CLASSES : UI_CHROME_CLASSES;
  const restore = prepareEdgesForCapture(element);

  try {
    return await toPng(element, {
      backgroundColor: options.backgroundColor,
      pixelRatio: options.pixelRatio ?? 2,
      filter: makeFilter(excludeClasses),
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
  const excludeClasses = options.excludePanels ? PANEL_CLASSES : UI_CHROME_CLASSES;
  const restore = prepareEdgesForCapture(element);

  try {
    const dataUrl = await toSvg(element, {
      backgroundColor: options.backgroundColor,
      pixelRatio: options.pixelRatio ?? 2,
      filter: makeFilter(excludeClasses),
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

