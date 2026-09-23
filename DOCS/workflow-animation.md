# Animated Diagram Export & Workflow Animation

_Status: shipped (client-side looping SVG exports). GIF/WebP via offline CLI. Added June 2026._

Two export capabilities turn a static architecture diagram into motion, in the app's own
visual style. Both produce a **looping animated SVG** (the animation repeats forever in a
browser):

1. **Export Animated SVG** — flowing "data-flow" circles ride every edge simultaneously.
2. **Export Workflow Animation** — plays the diagram's `workflow[]` **step-by-step**: one edge
   flows at a time (recolored vivid amber + thickened so it pops), a caption shows the step
   description at the top, the involved nodes pulse with a highlight ring, and all other edges
   and labels are dimmed.

Both are in the **Export** menu. "Export Workflow Animation" is disabled when the diagram has
no workflow steps.

Product decision: the app ships **only the looping SVG** (client-side, no infra). GIF/WebP —
needed for GitHub/Teams/Slack, which strip SVG animation — are produced with the **offline
CLI** (below), not a backend, to keep the container lean.

---

## Why

The AI already emits a `workflow[]` narrative (`{ step, description, services }`) that was only
shown statically in the Workflow panel. Animating it turns that data into an explainer that's
ideal for blog posts, Teams/Slack, and decks — using the exact diagram the user built.

---

## How it works

Both features are **client-side and dependency-free**. They post-process the SVG produced by
`captureDiagramAsSvg` (html-to-image) and inject SVG **SMIL** animation. The motion is carried
by the SVG itself — open it in a browser to see it play.

**Looping:** every effect (edge recolor, flow circles, node rings, captions) uses a single
repeating master cycle — `dur = totalSteps × stepDur`, `repeatCount="indefinite"`, with
`keyTimes` marking each effect's active window. That makes the whole sequence loop forever
(one-shot `begin=…` animations would freeze after a single pass).

Code:
- `src/utils/animateEdges.ts` — `animateEdgeFlow(svg)` (simultaneous flow).
- `src/utils/sequenceWorkflow.ts` — `sequenceWorkflowSvg(svg, { nodes, edges, workflow, stepDurSec })`
  (sequenced workflow). Default 3s per step.
- `src/App.tsx` — `exportAsAnimatedSvg` and `exportWorkflowAnimation` callbacks + menu items;
  telemetry via `trackExport('animated-svg' | 'workflow-animation', …)`.

### Step → edge mapping (the interesting part)

Saved diagrams do **not** number edges, so we don't rely on edge order. Instead:

1. Each `react-flow__edge-path` in the captured SVG is matched to a JSON edge by **exact
   ReactFlow id** — the enclosing group carries `data-testid="rf__edge-<edgeId>"`. Geometry
   (handle points vs path start/end) is only a **fallback** for edges whose id isn't found.
   (Geometry-only matching failed on diagrams where several edges share a start node — the
   nearest-point match swapped them.)
2. Each workflow step lists the `services` it touches; we greedily assign each step its forward
   edge whose endpoints are both in that step's service set.
3. Node highlight boxes are **reconstructed from the matched edge endpoints**, not from the JSON
   `positionAbsolute` (which can be stale if a node was moved after saving).

This has mapped every step to the correct edge across multiple validation diagrams with zero
manual hints.

---

## GIF / WebP (offline pipeline — the chosen path)

Animated **SVG plays in browsers but GitHub/Teams/Slack strip SVG animation** — those surfaces
need a raster GIF/WebP, which requires rasterizing frames (headless Chromium + ffmpeg). We
deliberately keep this **out of the app/container**; run it from the CLI instead. The pipeline
lives under `OSS/Spec2Cloud/` (gitignored clone of Azure-Samples/Spec2Cloud `excalidraw-azure`
scripts):

```bash
# 1) export a plain SVG (Export SVG) + the diagram JSON from the app, then:
node OSS/Spec2Cloud/sequence-workflow-svg.cjs <plain-export.svg> <diagram.json> out.svg 3.0
# duration must equal steps × stepDur (e.g. 8 steps × 3s = 24):
node OSS/Spec2Cloud/skills/excalidraw-azure/scripts/svg-to-anim.js out.svg --duration 24 --fps 9
# -> out.gif (keep; loops via -loop 0) + out.webp (often large; usually delete)
```

### Gotchas we hit (and fixed)

1. **Nested SVG timeline.** The flow circles live inside a **nested `<svg class="react-flow__edges">`**
   (inside the export's `<foreignObject>`). The frame capture only paused/seeked the **root**
   SVG, so the nested timeline ran in real time during capture — later steps were missed. Fix:
   seek **every** `<svg>` (root + nested) in `svg-to-anim.js`.
2. **Highlight drift.** Placing highlight rings at JSON `positionAbsolute` drifted when nodes had
   been moved after save. Fix: reconstruct node boxes from the actual matched edge endpoints.
3. **Wrong edges when nodes share a start.** Geometry matching swapped edges that share a source
   node. Fix: map by exact `data-testid="rf__edge-<id>"`, geometry only as fallback.
4. **Labels stayed bright.** Dimming the label container by *prepending* `opacity` was overridden
   by html-to-image's inlined `opacity: 1` (last declaration wins). Fix: **append** `;opacity:0.28`.
5. **Active edge too subtle.** Raising opacity 0.16→1 on a thin blue line wasn't noticeable. Fix:
   recolor the active edge to vivid amber + thicker stroke + bright yellow flow circles.
6. **SVG didn't loop.** One-shot `begin=…` animations freeze after one pass. Fix: a repeating
   master cycle (`dur=TOTAL`, `repeatCount="indefinite"`, `keyTimes` windows).

---

## Provenance

The animation technique (flow circles via `<animateMotion><mpath>`, SVG→GIF/WebP capture) is
adapted from the **`excalidraw-azure`** skill in
[Azure-Samples/Spec2Cloud](https://github.com/Azure-Samples/Spec2Cloud) (MIT). We kept our
ReactFlow look and added the workflow sequencing + geometry-based step→edge resolver.

---

## Possible next steps

- **In-app "Play Workflow" scrubber** — interactive step playback over the live canvas
  (reuse the step→edge resolver), rather than only file export.
- Tunables in the UI: seconds-per-step, dim level, highlight color.

**Decided against (for now):** a backend GIF/WebP endpoint. It would add ~150 MB of Chromium +
ffmpeg to the container; GIFs stay in the offline CLI instead.
