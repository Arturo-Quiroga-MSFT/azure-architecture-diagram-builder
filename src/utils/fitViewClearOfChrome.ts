// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { getNodesBounds, getViewportForBounds, type Node, type ReactFlowInstance } from 'reactflow';

interface FitOptions {
  padding?: number;
  duration?: number;
}

const GAP = 12;
// Below this share of the canvas the reserved bands would squeeze the diagram
// too far, so a plain fit over the whole canvas is the better trade-off.
const MIN_USABLE_SHARE = 0.4;
// The main canvas uses these limits too. Below React Flow's default of 0.5 so
// a large diagram still fits above the bottom dock on a short screen.
export const CANVAS_MIN_ZOOM = 0.25;
export const CANVAS_MAX_ZOOM = 2;

function bandHeights(canvasEl: HTMLElement, canvas: DOMRect) {
  const rect = (selector: string) => canvasEl.querySelector<HTMLElement>(selector)?.getBoundingClientRect();

  // Top band: the canvas tool row (Layout, Select, Style...).
  const tools = rect('.canvas-tools-host');
  const top = tools && tools.height > 0 ? Math.max(0, tools.bottom - canvas.top) + GAP : 0;

  // Bottom band: the metadata dock. The minimap only occupies the bottom-right
  // corner (the dock already stops short of it), so it does not reserve a band.
  const dock = rect('.canvas-bottom-dock');
  const reach = dock && dock.height > 0 ? canvas.bottom - dock.top : 0;
  return { top, bottom: reach > 0 ? reach + GAP : 0 };
}

// Dock items (model badge, layout hint) can mount a moment after a fit, and
// side panels can settle and resize the canvas, either of which would leave the
// diagram framed for the wrong space. For a short window after each fit, any
// change in dock height or canvas size re-frames.
const SETTLE_MS = 1500;
let cancelSettle: (() => void) | null = null;

function watchDockWhileSettling(
  instance: ReactFlowInstance,
  container: HTMLElement,
  options: FitOptions,
): void {
  cancelSettle?.();
  const dock = container.querySelector<HTMLElement>('.canvas-bottom-dock');
  const canvasEl = container.querySelector<HTMLElement>('.react-flow');
  if (!dock || !canvasEl || typeof ResizeObserver === 'undefined') return;
  const measure = () => {
    const d = dock.getBoundingClientRect();
    const c = canvasEl.getBoundingClientRect();
    return `${Math.round(d.height)}|${Math.round(c.width)}|${Math.round(c.height)}`;
  };
  let last = measure();
  const observer = new ResizeObserver(() => {
    const next = measure();
    if (next === last) return;
    last = next;
    frame(instance, container, { ...options, duration: 0 });
  });
  observer.observe(dock);
  observer.observe(canvasEl);
  // Any pan, zoom or click means the user has taken over the viewport.
  const onUserInput = () => cancelSettle?.();
  const inputs = ['pointerdown', 'wheel', 'keydown'] as const;
  for (const type of inputs) container.addEventListener(type, onUserInput, { capture: true, passive: true });
  const timer = window.setTimeout(() => cancelSettle?.(), SETTLE_MS);
  cancelSettle = () => {
    observer.disconnect();
    window.clearTimeout(timer);
    for (const type of inputs) container.removeEventListener(type, onUserInput, { capture: true });
    cancelSettle = null;
  };
}

/**
 * Frame the diagram in the part of the canvas that the tool row and the bottom
 * dock (title block, prompt, legend) do not cover. Falls back to a regular
 * fitView when that area would be too small or cannot be measured.
 */
export function fitViewClearOfChrome(
  instance: ReactFlowInstance | null | undefined,
  container: HTMLElement | null | undefined,
  options: FitOptions = {},
): void {
  if (!instance) return;
  frame(instance, container, options);
  if (container) watchDockWhileSettling(instance, container, options);
}

function frame(
  instance: ReactFlowInstance,
  container: HTMLElement | null | undefined,
  options: FitOptions,
): void {
  const { padding = 0.2, duration = 0 } = options;
  // Scope to this canvas: other React Flow instances (e.g. the comparison view)
  // stay mounted while hidden, so a document-wide lookup can find the wrong one.
  const canvasEl = container?.querySelector<HTMLElement>('.react-flow');
  const nodes = instance.getNodes().filter((node: Node) => !node.hidden);
  if (!canvasEl || nodes.length === 0) {
    instance.fitView({ padding, duration });
    return;
  }

  const canvas = canvasEl.getBoundingClientRect();
  const { top, bottom } = bandHeights(canvasEl, canvas);
  const height = canvas.height - top - bottom;
  if (canvas.width <= 0 || height < canvas.height * MIN_USABLE_SHARE) {
    instance.fitView({ padding, duration });
    return;
  }

  const bounds = getNodesBounds(nodes);
  const viewport = getViewportForBounds(bounds, canvas.width, height, CANVAS_MIN_ZOOM, CANVAS_MAX_ZOOM, padding);
  instance.setViewport({ x: viewport.x, y: viewport.y + top, zoom: viewport.zoom }, { duration });
}
