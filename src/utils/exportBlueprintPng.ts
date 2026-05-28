// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * exportBlueprintPng
 * ------------------
 * Off-screen capture + PNG download for `BlueprintArchitecture`. Mirrors the
 * structure of exportReferencePng.ts. Icons are pre-resolved to data: URLs so
 * the SVG <image> elements render with inline content (no network race during
 * html-to-image capture).
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import BlueprintArchitectureCanvas from '../components/BlueprintArchitectureCanvas';
import type { BlueprintArchitecture } from '../services/blueprintArchitectureAI';
import { captureDiagramAsPng } from './captureCanvas';
import { getServiceIconMapping } from '../data/serviceIconMapping';
import { resolveServiceIconLoose } from './serviceIconFuzzy';
import { loadIcon } from './iconLoader';
import { getModelSuffix } from './modelNaming';

export interface ExportBlueprintPngOptions {
  fileName?: string;
  author?: string;
  pixelRatio?: number;
  /** 'bottom' | 'right' | 'auto' (default 'auto'). Auto picks based on aspect ratio. */
  legendPosition?: 'bottom' | 'right' | 'auto';
}

const LEGEND_RIGHT_WIDTH = 340;

function resolveLegendForExport(
  position: 'bottom' | 'right' | 'auto' | undefined,
  cW: number,
  cH: number,
): 'bottom' | 'right' {
  if (position === 'bottom' || position === 'right') return position;
  return cW / Math.max(cH, 1) > 1.4 ? 'bottom' : 'right';
}

export async function exportBlueprintArchitectureAsPng(
  data: BlueprintArchitecture,
  options: ExportBlueprintPngOptions = {},
): Promise<void> {
  const {
    fileName,
    author,
    pixelRatio = 2,
    legendPosition,
  } = options;

  const titleSlug = shortSlug(data.title || 'blueprint');
  const stamp = formatStamp(new Date());
  const modelSuffix = getModelSuffix();
  const baseName = fileName
    ? fileName
    : `blueprint-${titleSlug}-${stamp}-${modelSuffix}`;
  const downloadName = `${baseName}.png`;

  const iconMap = await preloadIconMap(data);
  const personaIconUrl = await preloadPersonaIcon();

  const resolvedLegend = resolveLegendForExport(legendPosition, data.canvas.width, data.canvas.height);
  const hostPxWidth = resolvedLegend === 'right'
    ? data.canvas.width + LEGEND_RIGHT_WIDTH + 32
    : data.canvas.width + 96;

  const host = document.createElement('div');
  host.setAttribute('data-bp-arch-export-host', 'true');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.width = `${hostPxWidth}px`;
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';
  document.body.appendChild(host);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    root.render(
      React.createElement(BlueprintArchitectureCanvas, {
        data,
        author,
        iconMap,
        personaIconUrl,
        legendPosition: resolvedLegend,
      }),
    );

    const canvasEl = await waitForElement(host, '[data-bp-arch-canvas="true"]', 2000);
    if (!canvasEl) throw new Error('BlueprintArchitectureCanvas failed to mount.');

    // SVG <image> elements with data: URLs render synchronously; still let one
    // animation frame elapse for layout settle.
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    const dataUrl = await captureDiagramAsPng(canvasEl, {
      backgroundColor: '#ffffff',
      pixelRatio,
    });
    triggerDownload(dataUrl, downloadName);

    // Drop a JSON sidecar AFTER the PNG. We delay one tick so the browser
    // treats it as a separate download attempt instead of silently dropping
    // it under multi-download throttling.
    setTimeout(() => {
      try {
        console.log('📄 Blueprint JSON sidecar:', `${baseName}.json`);
        exportBlueprintArchitectureAsJson(data, { fileName: baseName });
      } catch (err) {
        console.warn('Blueprint JSON sidecar failed:', err);
      }
    }, 600);
  } finally {
    if (root) root.unmount();
    if (host.parentNode) host.parentNode.removeChild(host);
  }
}

// ─── Icon pre-loading ────────────────────────────────────────────────────────

async function preloadIconMap(
  data: BlueprintArchitecture,
): Promise<Record<string, string>> {
  const names = new Set<string>();
  for (const n of data.nodes || []) {
    if (n.kind === 'persona') continue;
    names.add(n.name);
  }
  const entries = await Promise.all(
    Array.from(names).map(async (name) => {
      const mapping = resolveServiceIconLoose(name) || getServiceIconMapping(name);
      if (!mapping) return [name, ''] as const;
      const path = `/Azure_Public_Service_Icons/Icons/${mapping.category}/${mapping.iconFile}.svg`;
      try {
        const url = await loadIcon(path);
        if (!url) return [name, ''] as const;
        const dataUrl = await fetchSvgAsDataUrl(url);
        return [name, dataUrl] as const;
      } catch {
        return [name, ''] as const;
      }
    }),
  );
  const out: Record<string, string> = {};
  for (const [name, url] of entries) if (url) out[name] = url;
  return out;
}

async function preloadPersonaIcon(): Promise<string | undefined> {
  const path = '/Azure_Public_Service_Icons/Icons/identity/10230-icon-service-Users.svg';
  try {
    const url = await loadIcon(path);
    if (!url) return undefined;
    const dataUrl = await fetchSvgAsDataUrl(url);
    return dataUrl || undefined;
  } catch {
    return undefined;
  }
}

async function fetchSvgAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) return '';
  const svg = await res.text();
  const encoded = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${encoded}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Short, readable slug — first ~4 words of the title, max 40 chars.
function shortSlug(raw: string): string {
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const stop = new Set(['with', 'and', 'the', 'a', 'an', 'for', 'of', 'to', 'in', 'on']);
  const kept = words.filter(w => !stop.has(w)).slice(0, 4);
  const slug = (kept.length ? kept : words.slice(0, 4)).join('-').slice(0, 40);
  return slug.replace(/^-|-$/g, '') || 'diagram';
}

// Compact local timestamp: YYYYMMDD-HHmm
function formatStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function triggerDownload(dataUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export interface ExportBlueprintJsonOptions {
  fileName?: string;
}

/**
 * Persist the blueprint as a JSON sidecar. Strips the (potentially large)
 * `metrics` field's verbose objects only if they exist, but otherwise dumps
 * the structure as-is so it round-trips back into the canvas if needed.
 */
export function exportBlueprintArchitectureAsJson(
  data: BlueprintArchitecture,
  options: ExportBlueprintJsonOptions = {},
): void {
  const { fileName } = options;
  const titleSlug = shortSlug(data.title || 'blueprint');
  const stamp = formatStamp(new Date());
  const modelSuffix = getModelSuffix();
  const baseName = fileName ?? `blueprint-${titleSlug}-${stamp}-${modelSuffix}`;
  const downloadName = `${baseName}.json`;

  const payload = {
    ...data,
    exportedAt: new Date().toISOString(),
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    triggerDownload(url, downloadName);
  } finally {
    // Revoke after a tick so the browser has time to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function waitForElement(
  host: HTMLElement,
  selector: string,
  timeoutMs: number,
): Promise<HTMLElement | null> {
  const start = performance.now();
  return new Promise((resolve) => {
    const check = () => {
      const el = host.querySelector(selector) as HTMLElement | null;
      if (el) return resolve(el);
      if (performance.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(check);
    };
    check();
  });
}
