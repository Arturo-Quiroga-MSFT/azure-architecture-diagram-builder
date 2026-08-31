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

### 2026-08-31 — Step 2 complete: Reports pane

The Export dropdown held 14 actions, a settings row and a history list. Those are
documents, not annotations, so they moved to a pane.

**One list, two renderers.** Each export is now an `ExportAction` descriptor
(`src/types/exportActions.ts`) built once in `App.tsx`. The toolbar dropdown and
`ReportsPane` both render that array, so they cannot drift. This removed ~210 lines of
duplicated JSX from `App.tsx`.

`disabledReason` replaces a separate `disabled` flag — the presence of the string is
what disables the action, so a disabled export can never exist without an explanation.
The pane prints that reason on the card instead of burying it in a `title` tooltip,
which was the main reason to move these out of a dropdown.

**Regression caught during verification.** The first pass dropped the `azureNodeCount === 0`
guard on *Workflow (Markdown)*, so it was clickable on an empty diagram. Found by
diffing the rendered toolbar list against the original JSX, not by reading the code.
Restored.

**Tested** — toolbar list vs pane list compared programmatically:

| Check | Result |
|---|---|
| Actions in toolbar dropdown | 14 |
| Cards in Reports pane | 14 |
| Labels + disabled states identical | yes |
| Disabled states on empty diagram | match pre-refactor JSX |
| Export runs from the pane | Draw.io export produced a file and appeared in Recent exports |
| Dark mode | verified |

`typecheck`, `lint`, `build`, `test:deterministic` (15 checks) and `test:bundle-budget`
all pass.

**Scope of that evidence:** one export (Draw.io) was executed end-to-end. The other 13
were verified as *present and correctly enabled*, not run. They call the same handlers as
before, but that is inference, not a test.

**Known wart, deferred to step 4:** the full canvas toolbar still renders above the
Reports pane, so canvas-only controls (Layout, Select, Focus, Collapse Groups, Validate)
show on a pane where they do nothing. Fixing this properly is the toolbar decomposition,
not a patch here.

**Next:** step 3 — convert `ValidationModal` into a right-dock panel and wire
finding → node cross-highlighting.

### 2026-08-31 — Step 3 complete: validation as a dock panel

`ValidationModal` is now `ValidationPanel`, a flex sibling of the canvas inside
`.workspace`. The canvas shrinks beside it instead of being covered, which is what
makes a finding able to point at the resource it is about.

**Cross-highlighting.** Findings already carried `finding.resources`. Hovering a finding
glows the matching nodes; the new *Locate* button pins them so the highlight survives
mouse-leave and panning. This reuses the existing `highlightedServices` glow and the
label-or-id resolver that `WorkflowPanel` used, now extracted to one `highlightServiceRefs`
callback rather than duplicated.

**Two traps found:**

1. `.modal-overlay` and `.modal-content` are defined in `ValidationModal.css` but used by
   **nine other modals**. Deleting `ValidationModal.tsx` would have dropped that import
   and unstyled all of them. `ValidationPanel` imports the CSS explicitly, with a comment.
2. The dark-mode header rule was scoped `.validation-modal .modal-header h2`. The panel is
   not that class, so the title rendered dark-on-dark. Caught in a screenshot, not by any
   automated check. The section headings had no dark rule at all — that one predates this
   change; fixed here since it is the same surface.

**Regression avoided:** the shared resolver initially dropped the original
`ids.length > 0 ? ids : refs` fallback, which would have silently broken workflow
highlighting for MCP-exported scenes. Restored before commit.

**Tested** — end to end against a live model run (GPT-5.2, 646 in / 3070 out tokens,
40.9s, 16 findings, overall score 42):

| Check | Result |
|---|---|
| Panel docks beside canvas | canvas 1730px, panel 416px, side by side |
| Nodes survive validation | 3 before → 3 during → 3 after |
| Hover finding → nodes glow | all 3 named resources glow, matched by label |
| Mouse-leave → glow clears | yes |
| Locate pins the set | yes |
| Pin survives mouse-leave | yes |
| Dark-mode heading contrast | `#e0e0e0` on `#1f1f1f` |

`typecheck`, `lint`, `build`, `test:deterministic`, `test:bundle-budget` and
`test:version` all pass.

**Correction worth keeping.** An earlier attempt concluded "the Azure OpenAI backend
returns 500 for every model". That was wrong: `npm run dev` starts Vite only, and the
proxy target on port 3001 was never running — the dev log said `ECONNREFUSED
127.0.0.1:3001`. `npm run dev:full` starts both. **Use `dev:full` for anything that
exercises an AI path.** A separate scare — two canvas nodes appearing to vanish — was a
race in the test harness's drop loop, not a regression; re-running with an assertion
after each drop showed 3/3/3.

**Next:** step 4 — decompose the toolbar behind the seams now that they exist.

### 2026-08-31 — Dock width and right-edge collisions

Widened the dock from 26rem to 30rem (480px) via a `--validation-dock-w` custom property.

Widening surfaced the real problem behind the clipped text reported from a live session:
**three elements are `position: fixed` against the right edge and were sitting on top of
the dock** — `.workflow-panel` (z-index 999), `.feedback-fab`, and `.impact-launcher`.
The dock is in normal flow, so it slid underneath them. Measured, not guessed: the
paragraph itself had `scrollWidth === clientWidth`, so it was never overflowing.

`ValidationPanel` now toggles `body.has-validation-dock`, and those three offset
themselves by the same variable.

**Self-inflicted bug caught in verification:** the first fix offset
`.workflow-panel.collapsed` too, which moved the collapsed body from a fully hidden
`right: -400px` to `right: 80px` — directly over the dock. Only the collapsed *header*
tab needs offsetting. Measured before/after in both states:

| State | Element | Overlaps dock |
|---|---|---|
| Collapsed | workflow body (`right` 2735→3135, off-screen) | no |
| Collapsed | workflow tab (right edge 2255 = dock left) | no |
| Expanded | workflow panel (1855→2255) | no |
| Either | feedback FAB, impact launcher (right edge 2235) | no |

Pre-existing and unchanged: the feedback/impact buttons overlap the *expanded* workflow
panel. They did before this work too.

**Next:** step 4 — decompose the toolbar behind the seams now that they exist.
