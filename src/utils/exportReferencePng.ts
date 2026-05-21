// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * exportReferencePng
 * ------------------
 * Mounts <ReferenceArchitectureCanvas> off-screen, waits for icon SVGs to
 * finish loading, captures the result as a PNG via the existing
 * `captureDiagramAsPng` pipeline, and triggers a browser download.
 *
 * This is additive — it does not affect the main ReactFlow canvas or any
 * existing export path. Invoked only from reference-mode generation.
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import ReferenceArchitectureCanvas from '../components/ReferenceArchitectureCanvas';
import type { ReferenceArchitecture } from '../services/referenceArchitectureAI';
import { captureDiagramAsPng } from './captureCanvas';
import { getServiceIconMapping } from '../data/serviceIconMapping';
import { loadIcon } from './iconLoader';

export interface ExportReferencePngOptions {
  /** Filename (without extension) for the downloaded PNG. */
  fileName?: string;
  /** Canvas width in pixels. Defaults to 1600. */
  width?: number;
  /** Author/credit chip shown in header. */
  author?: string;
  /** Output pixel ratio (2 = retina). */
  pixelRatio?: number;
}

/**
 * Render the editorial canvas off-screen and download it as a PNG.
 * Resolves once the download has been triggered.
 */
export async function exportReferenceArchitectureAsPng(
  data: ReferenceArchitecture,
  options: ExportReferencePngOptions = {},
): Promise<void> {
  const {
    fileName = sanitizeFileName(data.title || 'reference-architecture'),
    width = 1600,
    author,
    pixelRatio = 2,
  } = options;

  // 1. Pre-resolve every icon URL up front and inline as a data: URL.
  //    This guarantees the rendered <img> tags have real, decoded sources
  //    before we capture — no async race with React effects or dynamic imports.
  const iconMap = await preloadIconMap(data);
  const actorIconUrl = await preloadActorIcon();

  // 2. Create a detached host positioned far off-screen.
  const host = document.createElement('div');
  host.setAttribute('data-ref-arch-export-host', 'true');
  host.style.position = 'fixed';
  host.style.left = '-100000px';
  host.style.top = '0';
  host.style.width = `${width}px`;
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';
  document.body.appendChild(host);

  let root: Root | null = null;

  try {
    root = createRoot(host);
    root.render(
      React.createElement(ReferenceArchitectureCanvas, {
        data,
        width,
        author,
        iconMap,
        actorIconUrl,
      }),
    );

    // 3. Wait for the root element to actually appear in the DOM.
    const canvasEl = await waitForElement(
      host,
      '[data-ref-arch-canvas="true"]',
      2000,
    );
    if (!canvasEl) {
      throw new Error('ReferenceArchitectureCanvas failed to mount.');
    }

    // 4. Wait for all <img> tags inside the canvas to finish decoding.
    //    With data: URLs this is fast, but still required.
    await waitForImages(canvasEl, 5000);

    // 5. Extra paint tick so layout/fonts settle before capture.
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    // 6. Capture via the proven html-to-image pipeline.
    const dataUrl = await captureDiagramAsPng(canvasEl, {
      backgroundColor: '#ffffff',
      pixelRatio,
    });

    // 7. Trigger download.
    triggerDownload(dataUrl, `${fileName}.png`);
  } finally {
    if (root) root.unmount();
    if (host.parentNode) host.parentNode.removeChild(host);
  }
}

// ─── Icon pre-loading ────────────────────────────────────────────────────────

/**
 * Resolve every service-name → data: URL up front so the canvas can render
 * synchronously with real <img src> values.
 */
async function preloadIconMap(
  data: ReferenceArchitecture,
): Promise<Record<string, string>> {
  // Collect every name that might need an icon.
  const names = new Set<string>();
  for (const stage of data.stages || []) {
    for (const svc of stage.services || []) names.add(svc.name);
  }
  // (Foundation + cross-cutting render as text chips today; no icons needed.)

  const entries = await Promise.all(
    Array.from(names).map(async (name) => {
      const mapping = getServiceIconMapping(name);
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
  for (const [name, url] of entries) {
    if (url) out[name] = url;
  }
  return out;
}

/** Pre-resolve the shared users/actors icon as a data: URL. */
async function preloadActorIcon(): Promise<string | undefined> {
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

/**
 * Fetch an SVG asset and convert it to a `data:image/svg+xml;base64,...` URL.
 * Inlining as data URL bypasses any cross-origin / network timing concerns
 * during the html-to-image capture step.
 */
async function fetchSvgAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) return '';
  const svg = await res.text();
  // base64 encode (handles UTF-8 safely)
  const encoded = btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${encoded}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeFileName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'reference-architecture';
}

function triggerDownload(dataUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
      if (el) {
        resolve(el);
        return;
      }
      if (performance.now() - start > timeoutMs) {
        resolve(null);
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

async function waitForImages(root: HTMLElement, timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs;

  // Initial snapshot of <img> elements
  const collect = () =>
    Array.from(root.querySelectorAll<HTMLImageElement>('img'));

  // Wait until at least one render pass has run and image set is stable.
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  while (performance.now() < deadline) {
    const imgs = collect();
    const pending = imgs.filter((img) => !img.complete || img.naturalWidth === 0);
    if (pending.length === 0) return;
    await Promise.race([
      Promise.all(
        pending.map(
          (img) =>
            new Promise<void>((resolve) => {
              const done = () => resolve();
              img.addEventListener('load', done, { once: true });
              img.addEventListener('error', done, { once: true });
            }),
        ),
      ),
      new Promise<void>((r) => setTimeout(r, 250)),
    ]);
  }
}
