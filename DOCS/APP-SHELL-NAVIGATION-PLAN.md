# App Shell & Navigation Plan

**Branch:** `feature/app-shell-navigation`
**Started:** 2026-08-31 from `main` @ `82b4d1e` (v1.10.1)
**Status:** Step 1 in progress

## The problem in one sentence

The top toolbar carries ~27 controls across two rows, and `src/App.tsx` is 4,570 lines
with 54 modal references — so every new capability makes the tool harder to use and
harder to change.

## What we are *not* doing

A sibling internal project ("AI Architect — Architecture Decision Engine") uses a left
nav of full pages: Dashboard, Assessments, Architectures, Compare, What-If, Cost
Analysis, Security & Compliance, Roadmap, Reports, Settings.

That IA suits an **assessment** app — fill a wizard, generate a report, browse it. AADB is
a **canvas** app. Canvas tools (Figma, Miro, draw.io, Visio, Lucid) do not put primary
structure in left page-nav, because the canvas has to stay on screen.

Concretely: cost in AADB is *per node* and WAF findings *point at resources*. Moving
either to its own page severs the link between a finding and the thing it is about. We
would trade a crowded toolbar for worse navigation.

So: **adopt the left rail, reject the page-per-feature IA.**

## Target layout

```
┌──┬──────────────────────────────────────┬─────────────┐
│  │  slim top bar: Save/Load/Export ·    │             │
│  │  region · model · [Generate]         │  contextual │
│na├──────────────────────────────────────┤  right dock │
│v │                                      │  ┌─────────┐│
│  │            CANVAS                    │  │Props    ││
│ra│         (always mounted)             │  │Cost     ││
│il│                                      │  │Validate ││
│  │                                      │  │Chat     ││
│  │        ╭─ floating canvas tools ─╮   │  └─────────┘│
│  │        │ layout select style align│  │             │
└──┴──────────────────────────────────────┴─────────────┘
```

Note the existing `IconPalette` (service icons for drag-and-drop) stays where it is,
immediately right of the new nav rail. The rail is navigation; the palette is content.

### Three placement rules

Every control gets sorted by one question — *does this need the diagram visible?*

| Needs the diagram | Placement |
|---|---|
| No — it is a document or a list | Nav rail, full pane |
| Yes — it annotates or explains the diagram | Right dock tab |
| Yes — it acts on a selected object | Floating canvas toolbar, or contextual on selection |

### Nav rail — 4 items, and a high bar for a 5th

| Item | Contents | Why it earns a full pane |
|---|---|---|
| Canvas | the diagram | default view |
| Library | saved architectures, version history, snapshots | a gallery, not a canvas |
| Reports | deck exports, cost breakdown docs, deployment guides, model comparisons | output artifacts |
| Settings | model config, defaults, preferences | never needs the canvas |

### Right dock — follow the workflow we already teach

`JourneyStrip` already teaches **Create → Refine → Validate & Improve → Share or Build**.
Dock tabs should reinforce that model rather than invent competing categories. This is
the one place AADB has a real advantage: the sibling app has to invent generic nav
because it has no narrative; we have one.

### Leaving the global chrome entirely

Layout, Select, Style, Align, Collapse Groups, Add Group, Exit Focus act on canvas
objects, so they belong near the object. Relocating these removes roughly a third of the
current toolbar on its own.

## The real win: modals → dock panels

54 modal wirings is the deeper problem. A modal blocks the canvas, cannot stay open
while you edit, and cannot cross-highlight. Converting `ValidationModal`,
`NodePricingEditor`, `CompareValidationModal`, and `ArchitectureChatPanel` into dock
panels is probably a larger usability gain than the navigation change — and it is what
makes *click a WAF finding → the offending node pulses on canvas* possible at all.

## Migration path

Deliberately incremental. A layout rewrite against a 4,570-line `App.tsx` is where this
would die.

| Step | Change | Exit condition |
|---|---|---|
| 1 | Add nav rail + shell as **pure layout wrappers**. Canvas unchanged inside. | No visual or behavioural regression on the canvas. |
| 2 | Move Reports/Exports to its own pane. | Lowest-coupling feature proves the pattern. |
| 3 | Convert `ValidationModal` to a dock panel. | Cross-highlighting works; proves the dock's value. |
| 4 | Decompose `App.tsx` behind the new seams. | Only *after* the seams exist. |

### State constraint (drives the step 1 design)

Switching panes must not unmount the canvas — React Flow state, undo history, and
selection all live there. Step 1 therefore **hides** non-active panes rather than
unmounting the canvas. Revisit only if a store owns enough to rebuild the canvas
losslessly.

## Risk note

AADB is deployed and in use; the sibling app is a mockup with nothing running, so it
costs them nothing to redraw. Take the two changes with the best usability-per-risk
ratio — the nav rail and the validation dock panel — and leave the rest of the toolbar
alone until those land.

## Progress log

### 2026-08-31 — Branch created

From `main` @ `82b4d1e` (v1.10.1). Plan documented.

### 2026-08-31 — Step 1 complete: shell + nav rail

Added `NavRail` (4 items), `appViewStore`, and a placeholder pane. The canvas is
wrapped, not restructured — no existing canvas code moved.

**Design detail worth keeping.** The first attempt hid the inactive canvas with
`display: none`. React Flow then logged *"parent container needs a width and a
height"* on every pane switch, because a collapsed container drops its viewport
dimensions. Replaced with `position: absolute; inset: 0; visibility: hidden`, so the
canvas stays laid out at full size while invisible and non-interactive. `.workspace`
gained `position: relative` as its containing block.

**Tested** — 3 nodes dragged onto the canvas, then Canvas → Reports → Canvas:

| Property | Before | While hidden | After |
|---|---|---|---|
| Node count | 3 | 3 | 3 |
| Viewport transform | `matrix(2,0,0,2,208.5,-171)` | unchanged | unchanged |
| Canvas height | 1430 | 1430 | 1430 |
| Cost total | $50.00/mo | $50.00/mo | $50.00/mo |

No React Flow dimension warnings after the fix. Canvas returned with nodes, cost
badges, palette, legend and minimap intact.

`npm run lint` (max-warnings 0), `npm run typecheck` (both tsconfigs), and
`npm run test:deterministic` (15 checks) all pass.

**Scope of that evidence:** this covers React Flow node/viewport/cost state across one
pane round-trip. It does *not* cover undo history, an open modal during a switch, or
export/capture while a non-canvas pane is active. Worth checking before step 2 moves
real content into a pane.

**Known minor behaviour change:** `IconPalette` unmounts on non-canvas panes, so its
collapsed/expanded toggle resets on return. Accepted — it is a UI toggle, not work.

**Next:** step 2 — move Reports/Exports into the Reports pane.
