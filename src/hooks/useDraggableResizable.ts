// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { useRef, useState, useCallback } from 'react';

export interface PanelGeometry {
  x: number;   // left offset from viewport left (px)
  y: number;   // top offset from viewport top (px)
  w: number;   // width (px)
  h: number;   // height (px)
}

interface Options {
  initial: PanelGeometry;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

/**
 * useDraggableResizable
 *
 * Returns geometry state and two pointer-event handlers:
 *   - onDragStart  → attach to the panel header (drag to move)
 *   - onResizeStart → attach to the resize handle (drag to resize)
 *
 * Uses pointer capture so the interaction stays live
 * even when the mouse moves faster than React can re-render.
 */
export function useDraggableResizable({
  initial,
  minW = 280,
  minH = 200,
  maxW = 700,
  maxH = 700,
}: Options) {
  const [geom, setGeom] = useState<PanelGeometry>(initial);
  // Keep a mutable ref so event callbacks always read the latest value
  const geomRef = useRef<PanelGeometry>(initial);

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  // ── Drag to move ──────────────────────────────────────────────────────────
  const onDragStart = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    // Capture BEFORE React nullifies e.currentTarget after the handler returns
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    el.setPointerCapture(pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const startGeom = { ...geomRef.current };

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const next: PanelGeometry = {
        ...startGeom,
        x: clamp(startGeom.x + dx, 0, vw - startGeom.w),
        y: clamp(startGeom.y + dy, 0, vh - startGeom.h),
      };
      geomRef.current = next;
      setGeom(next);
    };

    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }, []);

  // ── Drag to resize ────────────────────────────────────────────────────────
  const onResizeStart = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    el.setPointerCapture(pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const startGeom = { ...geomRef.current };

    const onMove = (ev: PointerEvent) => {
      const dw = ev.clientX - startX;
      const dh = ev.clientY - startY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const newW = clamp(startGeom.w + dw, minW, Math.min(maxW, vw - startGeom.x));
      const newH = clamp(startGeom.h + dh, minH, Math.min(maxH, vh - startGeom.y));
      const next: PanelGeometry = { ...startGeom, w: newW, h: newH };
      geomRef.current = next;
      setGeom(next);
    };

    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }, [minW, minH, maxW, maxH]);

  /** Call this when you want to reset back to default position/size */
  const reset = useCallback(() => {
    geomRef.current = initial;
    setGeom(initial);
  }, [initial]);

  return { geom, onDragStart, onResizeStart, reset };
}
