// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * animateEdgeFlow — add flowing "data-flow" circles to a captured ReactFlow SVG.
 *
 * Operates purely on the SVG text produced by `captureDiagramAsSvg`. For every
 * `<path class="react-flow__edge-path">` it:
 *   1. assigns a unique id,
 *   2. injects two <circle> siblings (a bright head + a fainter tail) that ride
 *      the edge via <animateMotion><mpath href="#id"/>.
 *
 * Because the circles are inserted as siblings of the path (inside the same
 * `<svg class="react-flow__edges">`), they inherit the identical viewport
 * transform and align exactly with the rendered edges.
 *
 * No external dependencies and no DOM — safe to run client-side. The animation
 * is carried by the SVG itself (open in a browser to see motion). Note: GitHub
 * strips SVG animation in READMEs; use a GIF/WebP for those surfaces.
 */

export interface AnimateEdgeFlowOptions {
  /** Bright head circle radius (px, in flow units). Default 7. */
  headRadius?: number;
  /** Fainter tail circle radius (px, in flow units). Default 4.5. */
  tailRadius?: number;
  /** Base animation cycle duration in seconds. Default 2.0. */
  baseDuration?: number;
  /** Fallback palette when an edge has no encoded arrowhead color. */
  palette?: string[];
}

const DEFAULT_PALETTE = ["#1971c2", "#2f9e44", "#e8590c", "#9c36b5", "#1098ad", "#f08c00"];

// Matches a react-flow edge path, whether self-closing or paired/empty.
const EDGE_RE = /(<path\b[^>]*?react-flow__edge-path[^>]*?)(\/>|>\s*<\/path>|>)/g;

export function animateEdgeFlow(svgText: string, options: AnimateEdgeFlowOptions = {}): string {
  const headRadius = options.headRadius ?? 7;
  const tailRadius = options.tailRadius ?? 4.5;
  const baseDuration = options.baseDuration ?? 2.0;
  const palette = options.palette ?? DEFAULT_PALETTE;

  let svg = svgText;

  // Ensure the xlink namespace is declared on the root <svg> (for <mpath>).
  if (!/xmlns:xlink=/.test(svg)) {
    svg = svg.replace(/<svg\b([^>]*)>/, '<svg$1 xmlns:xlink="http://www.w3.org/1999/xlink">');
  }

  let i = 0;
  svg = svg.replace(EDGE_RE, (_full, open: string, close: string) => {
    const id = `rfflow-${i}`;
    // Prefer the arrowhead color encoded in marker-end (e.g. ...color=#0078d4...).
    const m = /color=#([0-9a-fA-F]{6})/.exec(open);
    const color = m ? `#${m[1]}` : palette[i % palette.length];
    const dur = (baseDuration + (i % 4) * 0.35).toFixed(2);
    const begin = (-(i * 0.3)).toFixed(2); // stagger so flows don't pulse in sync
    const tailBegin = (parseFloat(begin) - parseFloat(dur) / 2).toFixed(2);
    i++;

    const head =
      `<circle r="${headRadius}" fill="${color}" opacity="0.95">` +
      `<animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" rotate="0">` +
      `<mpath xlink:href="#${id}" href="#${id}"/></animateMotion></circle>`;
    const tail =
      `<circle r="${tailRadius}" fill="${color}" opacity="0.45">` +
      `<animateMotion dur="${dur}s" begin="${tailBegin}s" repeatCount="indefinite" rotate="0">` +
      `<mpath xlink:href="#${id}" href="#${id}"/></animateMotion></circle>`;

    return `${open} id="${id}"${close}${head}${tail}`;
  });

  return svg;
}
