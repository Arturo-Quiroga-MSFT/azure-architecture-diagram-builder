# Layout Engines Comparison: Dagre vs ELK

## Overview

The Azure Architecture Diagram Builder supports two graph layout engines that can be switched at any time via the **Layout → Engine** dropdown in the toolbar. Both engines solve the same problem — automatically positioning Azure service nodes and groups into readable, professional diagrams — but they use different algorithms and produce different results.

| Feature | Dagre | ELK |
|---------|-------|-----|
| **Library** | [dagre](https://github.com/dagrejs/dagre) | [elkjs](https://github.com/kieler/elkjs) |
| **Origin** | JavaScript community project | Eclipse Layout Kernel (academic, Kiel University) |
| **Algorithm** | Sugiyama-based layered layout | Layered (+ multiple other algorithms) |
| **Execution** | Synchronous | Asynchronous (Web Worker capable) |
| **Compound nodes** | Basic support | First-class hierarchical support |
| **Bundle size** | ~30 KB | ~140 KB |

---

## Dagre

### How It Works

Dagre implements a simplified version of the Sugiyama algorithm for layered graph drawing:

1. **Layer assignment** — Assigns nodes to horizontal/vertical layers based on edge direction
2. **Crossing reduction** — Reorders nodes within layers to minimize edge crossings
3. **Coordinate assignment** — Positions nodes with spacing and alignment
4. **Compound nodes** — Groups are treated as parent containers (basic support)

### Strengths

- **Fast** — Synchronous execution, typically <50ms for diagrams up to ~50 nodes
- **Battle-tested** — Widely used in tools like Mermaid.js, React Flow examples, and many production systems
- **Predictable** — Simple algorithm produces consistent, expected results
- **Lightweight** — Small bundle size (~30 KB), minimal impact on app load time
- **Simple API** — Straightforward graph-in, positions-out interface

### Weaknesses

- **Limited compound node handling** — Groups sometimes overlap; our post-processing `resolveGroupOverlaps()` step is needed to fix this
- **No longer actively maintained** — The dagre project has minimal updates
- **Fixed algorithm** — Only one layout strategy (Sugiyama layered); no built-in alternatives
- **Basic edge routing** — No sophisticated edge path computation
- **No hierarchy awareness** — Doesn't optimize for nested group structures

---

## ELK (Eclipse Layout Kernel)

### How It Works

ELK is a comprehensive layout framework from Kiel University. In our integration, we use its **layered algorithm** (also Sugiyama-based, but with many more optimization phases):

1. **Cycle breaking** — Handles cyclic graphs gracefully
2. **Layer assignment** — Multiple strategies (longest path, network simplex, etc.)
3. **Crossing minimization** — Layer sweep with barycenter heuristic
4. **Node placement** — Network simplex-based coordinate assignment
5. **Edge routing** — Orthogonal, polyline, or spline routing
6. **Hierarchy handling** — Native compound node/group layout with `INCLUDE_CHILDREN`

### Strengths

- **Superior compound node layout** — Groups (compound nodes) are first-class citizens; ELK computes proper sizes and positions for nested hierarchies without post-processing hacks
- **Highly configurable** — 150+ layout options for fine-tuning spacing, alignment, edge routing, crossing minimization strategies, and more
- **Multiple algorithms** — Beyond `layered`, ELK offers `force`, `stress`, `mrtree`, `box`, `random`, and `disco` algorithms
- **Better edge routing** — Can produce orthogonal edges that avoid node overlaps
- **Active development** — Maintained by the KIELER research group at Kiel University
- **Async execution** — Runs without blocking the UI thread; can use Web Workers for large graphs
- **Model order preservation** — Can respect the order in which services were defined by the AI

### Weaknesses

- **Larger bundle** — ~140 KB (vs ~30 KB for Dagre), though this is still modest
- **Async-only API** — Requires `await`; slightly more complexity in call sites
- **Learning curve** — Many configuration options can be overwhelming; defaults are good but tuning requires reading ELK documentation
- **Slower for small graphs** — The async overhead and richer algorithm make it marginally slower for simple diagrams (<10 nodes), though still well under 200ms

---

## Side-by-Side Comparison for Azure Diagrams

| Scenario | Dagre | ELK | Winner |
|----------|-------|-----|--------|
| Simple architecture (3–8 services, no groups) | Clean, fast | Clean, fast | **Tie** |
| Medium architecture (10–25 services, 3–5 groups) | Good, occasional group overlaps fixed by post-processing | Better group sizing and positioning out of the box | **ELK** |
| Complex architecture (25+ services, 5+ groups, cross-group connections) | Group overlaps more common; post-processing works but can shift groups awkwardly | Handles hierarchy natively; better edge routing between groups | **ELK** |
| Enterprise multi-tier (frontend → backend → data → security layers) | Good left-to-right flow | Excellent layered flow with better compound node separation | **ELK** |
| Radial layout | N/A (handled by custom code, not Dagre) | N/A (same custom code) | **Tie** |
| Swimlanes | Uses Dagre per-lane | Uses ELK per-lane | **Slight ELK edge** |
| Bundle size sensitivity | Minimal impact | +110 KB gzipped ~45 KB | **Dagre** |
| Initial load time | Instant | Instant (async init negligible) | **Tie** |

---

## Best Fit for Our Use Case

The Azure Architecture Diagram Builder generates **grouped, hierarchical diagrams** where services are organized into logical groups (Frontend, Backend, Data, Security, Networking, etc.) with cross-group connections. This is precisely the scenario where **ELK excels**.

### Why ELK is the better fit for complex architectures:

1. **Group-heavy diagrams** — Our AI generates 3–7 groups per architecture. ELK's native compound node support produces cleaner group boundaries without relying on overlap post-processing.

2. **Cross-group connections** — Enterprise architectures have many connections crossing group boundaries (e.g., App Service → SQL Database, API Management → multiple backends). ELK's `INCLUDE_CHILDREN` hierarchy handling routes these edges more cleanly.

3. **Consistent quality at scale** — As architectures grow beyond 15–20 services, ELK's more sophisticated algorithms maintain readability better than Dagre.

4. **Model order preservation** — ELK can respect the order in which the AI defined services (`considerModelOrder`), producing layouts that feel more intentional and aligned with the AI's logical grouping.

### When Dagre is still a good choice:

1. **Quick iterations** — For rapid prototyping with small diagrams, Dagre's synchronous nature feels snappier.

2. **Proven stability** — Dagre has been the engine since day one; all existing saved diagrams were laid out with it.

3. **Simpler debugging** — Fewer configuration options means fewer things to go wrong.

---

## How to Switch Engines

### In the UI
1. Click the **Layout** button in the toolbar
2. Find the **Engine** dropdown
3. Select **Dagre** or **ELK**
4. Click **Apply Layout** to re-layout the current diagram, or generate a new one

### The setting applies to:
- **AI Generate** — New diagrams use the selected engine
- **Apply Layout** — Re-arranging existing diagrams uses the selected engine
- **Layout Presets** — Flow (L→R), Flow (T→B), and Swimlanes all use the selected engine
- **Radial** — Uses custom positioning code (engine selection doesn't apply)

---

## Technical Details

### File Structure

| File | Purpose |
|------|---------|
| `src/utils/layoutEngine.ts` | Dagre implementation (original) |
| `src/utils/elkLayoutEngine.ts` | ELK implementation (new) |
| `src/utils/layoutPresets.ts` | Preset coordinator — delegates to selected engine |

### Interface Compatibility

Both engines export identical interfaces:

```typescript
// Core layout function
function layoutArchitecture(
  services: LayoutService[],
  connections: LayoutConnection[],
  groups: LayoutGroup[],
  options: Partial<LayoutOptions>
): { services: PositionedService[]; groups: PositionedGroup[] }

// Re-layout existing React Flow diagram
function relayoutDiagram(
  nodes: Node[],
  edges: Edge[],
  options: Partial<LayoutOptions>
): Node[]
```

> **Note:** ELK's versions are `async` (return Promises). The layout preset system handles this transparently.

### ELK Configuration

The ELK engine uses these key settings:

```typescript
{
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',              // Matches our LR default
  'elk.spacing.nodeNode': '180',          // Same as Dagre nodeSpacing
  'elk.layered.spacing.nodeNodeBetweenLayers': '250',  // Same as rankSpacing
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',         // Key for compound nodes
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
}
```

These defaults mirror Dagre's spacing to make switching engines produce comparable results. ELK's additional options can be tuned further if needed.

---

## References

- [Dagre GitHub](https://github.com/dagrejs/dagre)
- [ELK.js GitHub](https://github.com/kieler/elkjs)
- [ELK Algorithm Documentation](https://eclipse.dev/elk/reference/algorithms.html)
- [ELK Layout Options Reference](https://eclipse.dev/elk/reference/options.html)
- [Sugiyama Algorithm (Wikipedia)](https://en.wikipedia.org/wiki/Layered_graph_drawing)
