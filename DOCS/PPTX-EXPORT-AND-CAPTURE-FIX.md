# PPTX Export & SVG Edge Rendering Fix

## Overview

This document covers two related changes shipped together:

1. **Export Diagram as PowerPoint Slide** — new export format using PptxGenJS
2. **SVG edge rendering fix** — root-cause fix for invisible edges in all export formats (PNG, SVG, PPTX, validation snapshots)

---

## 1. Export Diagram as PowerPoint Slide

### Feature

The **"Export PPTX Slide"** option in the Export dropdown generates a single widescreen (16:9) `.pptx` file containing the current diagram.

### Implementation

**`src/services/pptxExporter.ts`**

PptxGenJS v4 is used entirely client-side — no backend, no server-side rendering.

The slide layout:

```
┌─────────────────────────────────────────────┐
│ ██ Azure-blue accent bar (0.08" top) ████  │
├─────────────────────────────────────────────┤
│  Header strip (slate-900 / slate-200)       │
│  Diagram title (bold)       Author · Date  │
├─────────────────────────────────────────────┤
│                                             │
│         Diagram image (contain)             │
│                                             │
├─────────────────────────────────────────────┤
│ Footer text                                 │
└─────────────────────────────────────────────┘
```

**Theme palettes** (automatically matched to the current dark/light canvas mode):

| Token | Dark mode | Light mode |
|-------|-----------|------------|
| `bg` | `1e293b` (slate-900) | `f8fafc` (slate-50) |
| `headerBg` | `0f172a` (slate-950) | `e2e8f0` (slate-200) |
| `accent` | `0078d4` (Azure blue) | `0078d4` (Azure blue) |
| `titleText` | `ffffff` | `0f172a` |
| `metaText` | `94a3b8` | `64748b` |
| `footerText` | `475569` | `94a3b8` |

The diagram image is captured via `captureDiagramAsPng()` (see section 2) which includes the edge fix. The image is placed with PptxGenJS `sizing: { type: 'contain' }` so the aspect ratio is always preserved regardless of diagram dimensions.

### Key API

```ts
import { exportDiagramAsPptx } from './services/pptxExporter';

const fileName = await exportDiagramAsPptx(imageDataUrl, {
  diagramName: string,
  author: string,
  date: string,
  isDarkMode: boolean,
});
// Triggers browser download of <diagramName>-<timestamp>.pptx
// Returns the filename string for export history recording
```

---

## 2. SVG Edge Rendering Fix

### The Problem

All export formats (PNG via html2canvas, and later PNG/SVG via html-to-image) produced images where **all ReactFlow edge lines were completely invisible** — no strokes, no arrowheads, no dashed patterns.

### Root Cause Analysis

ReactFlow renders edges as `<path>` elements inside an inline `<svg>` block. The `stroke` colour is not set as an SVG presentation attribute on the element; instead it comes from a CSS class rule:

```css
/* reactflow/dist/style.css */
.react-flow__edge-path {
  stroke: #b1b1b7;
  stroke-width: 1;
  fill: none;
}
```

When **html2canvas** was used, it rasterised the HTML but largely ignored SVG subtrees — edges were absent or at best blurred.

After switching to **html-to-image**, the DOM is serialised into an SVG document where the ReactFlow canvas sits inside a `<foreignObject>` element. This is the correct approach and preserves the DOM tree faithfully, but it introduces a different problem:

> **SVG `<foreignObject>` content does not inherit the document's external stylesheets.**

Inside the `<foreignObject>`, the browser's style resolution no longer applies the page CSS. Every `<path>` with `class="react-flow__edge-path"` but no inline `stroke` attribute gets `stroke: none` by default in SVG — completely invisible.

This affects:

- Sync edges (solid dark/light adaptive stroke)
- Async edges (dashed)
- Optional edges (dotted)
- Animated directional-flow edges
- Bidirectional pulse edges

### The Fix

**`src/utils/captureCanvas.ts`** — `prepareEdgesForCapture(wrapper: HTMLElement): () => void`

The strategy: **read computed style, write as presentation attribute, restore after capture**.

```
Before capture:
  for each svg path/line/polyline/circle in wrapper
    for each of 11 SVG attributes (stroke etc.)
      val = window.getComputedStyle(el)[camelCaseAttr]  ← CSS-class value IS present here
      el.setAttribute(attr, val)                         ← inline on element → survives foreignObject

After capture (try / finally):
  restore original attribute state (setAttribute / removeAttribute)
```

#### Why `getComputedStyle` works here but not inside foreignObject

`window.getComputedStyle()` is called on the **live DOM before serialisation**, where all stylesheets are fully applied and cascade resolution has already happened. The computed value for `stroke` on a ReactFlow edge path at this point is the resolved colour string (e.g. `rgb(177, 177, 183)`). Writing it back as a presentation attribute bakes it into the element itself, so it survives the serialisation context change.

#### Attributes inlined

```ts
const SVG_ATTRS_TO_INLINE = [
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'fill',
  'opacity',
  'marker-end',
  'marker-start',
];
```

`fill: rgba(0, 0, 0, 0)` and similar fully transparent values are normalised to `fill: none` (the SVG convention for "no fill") to avoid accidental black fills from `fill: transparent` being misinterpreted.

#### Restore contract

The function returns a restore callback. It is **always called in a `finally` block** so the live canvas SVG is never left in a modified state, even if the capture throws:

```ts
export async function captureDiagramAsPng(element, options) {
  const restore = prepareEdgesForCapture(element);
  try {
    return await toPng(element, resolvedOptions);
  } finally {
    restore();
  }
}
```

### Before / After

| Aspect | Before fix | After fix |
|--------|-----------|-----------|
| Edge lines | Invisible (no stroke) | Correctly coloured |
| Dashed async edges | Invisible | Dashed pattern preserved |
| Arrowheads | Missing | Rendered via `marker-end` |
| Animated edges | Invisible | Base style visible |
| Live canvas | N/A | Unaffected (attributes restored) |
| SVG export type | PNG rasterised inside SVG wrapper | True native vector SVG |
| Bundle size | +190KB (html2canvas) | −190KB (html-to-image) |

### Files Changed

| File | Change |
|------|--------|
| `src/utils/captureCanvas.ts` | **New**: capture utility with edge fix |
| `src/services/pptxExporter.ts` | **New**: PptxGenJS slide builder |
| `src/App.tsx` | Replaced 4× `html2canvas` call sites; added `exportAsPptx` callback and menu item |
| `package.json` | Added `pptxgenjs@^4.0.1`; `html2canvas` still present but no longer imported |

---

## Further Reading

- [html-to-image — foreignObject limitation](https://github.com/bubkoo/html-to-image#faqs)
- [SVG presentation attributes vs CSS properties](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/Presentation)
- [PptxGenJS v4 documentation](https://gitbrent.github.io/PptxGenJS/)
- [ReactFlow edge styling](https://reactflow.dev/docs/guides/custom-edges/)
