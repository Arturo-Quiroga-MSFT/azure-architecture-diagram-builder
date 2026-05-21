

Confirmed: you're on `feature/reference-architecture-mode`. Week 1 (schema + transform) is done — `RefStage`, `RefPathBand`, `RefDataSourceGroup`, `RefActor` exist in referenceArchitectureAI.ts, and `referenceToTopology()` currently flattens reference output into the regular network-flow canvas. That's exactly why your generated diagrams look like flow graphs, not like the editorial blueprint in 1778200277653.gif.

Here are the realistic paths to get an automatic PNG export in editorial style.

## What the sample actually is
Despite the `.gif` extension, the sample is a **static raster** with: a title block, an author chip, a labeled outer container, nested labeled groups (Store / Visualize / Analyze / Act), large icons with captions, numbered step badges on edges, free-floating side annotations, and a separate "OnPremise Network" band. It's basically a structured, themed layout — not animated. So the deliverable is a **PNG** (you can rename `.png` → `.gif` if you want to match filename convention, but there's no animation needed unless you want step-by-step reveal).

## Three viable approaches

**Option A — Off-screen React component + `html-to-image` (recommended, fastest)**
- Build a new `<ReferenceArchitectureCanvas ref={...} data={ReferenceArchitecture}>` that is *not* ReactFlow. Plain CSS grid / flex: outer container, stage columns or rows, group cards, icon tiles, numbered badges, side captions.
- Mount it off-screen (`position: fixed; left: -10000px;`) at a fixed export size (e.g. 1600×2000).
- Reuse the existing pipeline in captureCanvas.ts (`toPng`) — it already handles SVG attr inlining, hidden chrome, etc.
- Auto-trigger after `generateReferenceArchitectureWithAI()` succeeds in AIArchitectureGenerator.tsx (line 161).
- Pros: ships in ~1–2 days; full CSS control; reuses proven export code; HMR-friendly.
- Cons: layout drift across browsers if you don't pin sizes; needs careful CSS for repeatable output.

**Option B — Deterministic SVG generator (best fidelity)**
- Write `renderReferenceArchitectureSvg(ref: ReferenceArchitecture): string` that emits an SVG with absolute coordinates: stage rows, group rects, `<image>` for icons (or `<symbol>` referencing your Azure icon set), `<text>` captions, numbered `<circle>+<text>` badges, edge polylines with arrowheads.
- Layout: since stages and bands are explicit in your schema, you don't even need ELK — compute x/y from stage index + service index. Optionally call ELK only for edge routing.
- Convert SVG → PNG via `<canvas>` (or use `html-to-image`'s `toPng` on a wrapper `<div>` containing the SVG).
- Pros: pixel-deterministic, no DOM/CSS surprises, easy to also export as `.svg`, easy to render server-side later.
- Cons: longer to author the template; iteration is slower than CSS.

**Option C — Headless render (server-side, future)**
- Add a Playwright route in mcp-server/ that loads the editorial component, screenshots PNG. You already have Playwright as a devDep.
- Pros: identical output anywhere, scriptable for batch.
- Cons: heavier infra; only needed if MCP/agent flows must produce PNGs without the UI open.

## My recommendation
Do **A now, B later**:
1. Add `<ReferenceArchitectureCanvas>` as a new editorial renderer (banded layout, big icons, numbered badges, side captions), distinct from ReactFlow. This is also what your own roadmap comment in referenceArchitectureAI.ts calls "Weeks 2–3."
2. After `generateReferenceArchitectureWithAI()` resolves, render that component off-screen with the returned `ReferenceArchitecture` (already preserved as `__referenceArchitecture` on line 529), then `captureDiagramAsPng()` → auto-download `<name>-reference.png`.
3. Keep the existing ReactFlow canvas as-is — it stays the editable/network-flow view. The PNG is a *companion artifact*, not a replacement.
4. Later, port the renderer to pure SVG (Option B) so the MCP server can produce the same PNG headlessly.

## A few sub-decisions worth making upfront
- **Layout direction:** the sample is top-down with a side "on-prem" band. Pick top-down as default and only support left-right if you actually need it.
- **Icons:** reuse `iconLoader.ts` so the editorial canvas pulls from the same Azure icon set already on disk — keeps it visually identical to the editable canvas.
- **Numbered steps:** the sample's blue numbered badges come from `RefConnection.label` order. Add an optional `step?: number` to `RefConnection` so the editorial renderer can place a badge mid-edge.
- **Author chip / title block:** make these optional props on the editorial component, not part of the AI schema, so you can fill them from existing `TitleBlock` state.
- **Animated GIF?** Skip it unless you actually want step-reveal. `gifshot` is already in deps if you ever want it.

Want me to start with step 1 — scaffold the `<ReferenceArchitectureCanvas>` component (banded, non-ReactFlow) plus the auto-PNG hook in `AIArchitectureGenerator`?