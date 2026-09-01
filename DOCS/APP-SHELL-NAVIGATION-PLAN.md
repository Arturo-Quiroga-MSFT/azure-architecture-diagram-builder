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

### 2026-08-31 — Step 4: context-aware toolbar and the Library pane

Two changes, both applying the placement rules rather than inventing new UI.

**The toolbar is a canvas toolbar, so it only renders on the Canvas pane.** This closes
the wart logged in step 2, where Layout, Select, Focus, Collapse Groups and Validate
appeared on Reports where they did nothing. Measured: 20 controls on Canvas, 0 elsewhere.
The journey strip is hidden off-canvas for the same reason.

**Version history became the Library pane.** Saved versions and snapshots are a gallery,
not an annotation of the diagram, so by the rules they earn a pane. `VersionHistoryModal`
was converted the same way `ValidationModal` was — inner `.version-*` markup kept so
`VersionHistoryModal.css` still applies — and deleted. History and Snapshot left the
toolbar permanently.

**Bug found in verification, not in review:** saving a snapshot from the pane left the
list stale, because the pane loads once on mount and the save happens in a modal outside
it. Added a `reloadToken` the caller bumps after a successful save.

Also fixed: `SaveSnapshotModal` still told users snapshots are restored "from Version
History", which no longer exists. Version cards had no dark-mode rules at all — they were
light inside a dark modal before too; scoped dark rules added since nothing else uses
those classes now.

**Tested** — snapshot saved from the pane, listed, then restored:

| Check | Result |
|---|---|
| Header controls, Canvas vs Library | 20 → 0 |
| Toolbar + journey strip hidden off-canvas | yes |
| Snapshot saved from pane appears without manual refresh | yes, `2 versions saved` |
| Notes, service and connection counts render | yes |
| Restore switches back to Canvas, toolbar returns | yes |
| Dark mode card contrast | `#242424` card on `#1a1a1a` pane |

`typecheck`, `lint`, `build`, `test:deterministic`, `test:bundle-budget` and
`test:version` all pass. `src/App.tsx` is 4,594 lines, roughly flat versus the 4,570 at
the start — two panes' worth of markup left while pane wiring arrived.

**Still outstanding — the toolbar is 20 controls on Canvas.** Remaining reductions, in
rough value order:

1. Merge `Import Template` + `Import from Azure` into one Import menu, and
   `Compare Models` + `Compare Validation` into one Compare menu (−2).
2. Move Layout / Select / Style / Focus / Collapse Groups to a floating canvas toolbar
   (−5). Deferred deliberately: the canvas edges are already occupied by the legend,
   minimap, React Flow controls, nav hint, title block and prompt banner, so a floating
   bar needs a placement study rather than a guess.
3. Fill the Settings pane with model configuration and dark mode.

**Known gap introduced here:** the dark-mode toggle and model selector live in the canvas
toolbar, so they are unreachable from Reports, Library and Settings. Item 3 is the fix.

### 2026-08-31 — Step 5: Settings pane

Closes the gap above. The model settings body was extracted from
`ModelSettingsPopover` into `ModelSettingsControls`, used by both the toolbar popover and
the pane — the same one-definition-two-surfaces pattern as the export actions. All state
already lived in `modelSettingsStore`, so the two surfaces stay in sync with no extra
wiring.

Settings holds appearance (dark mode), validation display (`showNumericScore`, which was
previously only reachable from the validation panel header) and AI models.

Every rail item now has a real pane, so the `pending` state and
`.shell-pane-placeholder` were removed rather than left as dead code.

**Bug I introduced and caught in a screenshot:** both the Settings and Library panes used
`className="btn btn-secondary"`. That class is `color: white` on a translucent white
background — built for the **blue header**. On a white pane the buttons were invisible.
Added a `.pane-btn` class for light pane surfaces. Worth remembering: header-scoped
styling does not transfer to panes, and this is the second time that class-scoping
assumption has bitten during this migration.

**Tested:**

| Check | Result |
|---|---|
| Change model in pane → toolbar trigger updates | GPT-5.2 → GPT-5.1, reflected |
| Change model in toolbar → pane updates | GPT-5.2, reflected |
| Dark mode toggled from pane | `body.dark-mode` off, `localStorage.darkMode` `"false"` |
| Numeric score toggle persists | `{"showNumericScore":true}` |
| Pane button contrast, light mode | `#374151` on `#ffffff`, 1px `#d1d5db` border |

`typecheck`, `lint`, `build`, `test:deterministic`, `test:bundle-budget` and
`test:version` all pass.

**Remaining, deliberately not done:** the toolbar is still ~20 controls on Canvas.
Merging Import/Compare into menus is −2 for real nesting cost. The floating canvas
toolbar (−5) needs a placement decision from a human, because the canvas edges are
already occupied.

### 2026-08-31 — Step 6: Compare pane

`CompareValidationModal` became `CompareValidationPane` behind a fifth rail item.

**Why a pane and not the right dock.** The results grid is
`repeat(auto-fill, minmax(320px, 1fr))` and the pillar breakdown is `repeat(5, 1fr)`,
for up to 15 models. The dock is 480px — that yields one column and destroys the only
thing the feature exists for. It is a report, it does not annotate the diagram, so by the
placement rules it earns a pane.

`.compare-modal` is shared with `CompareModelsModal`, which is still a modal, so its
sizing is overridden inside `.compare-pane` rather than changed at source.

**Mounted lazily, then kept mounted.** A comparison across models is long-running, and a
pane that unmounts would kill it. The pane is not rendered until the first visit (it is a
large component), and from then on it stays mounted and is hidden with the same
absolute + `visibility: hidden` trick as the canvas. The avatar connection still drops
when the pane is not active, since that is a live speech session.

**Tested** — the central claim, measured directly rather than inferred:

| Check | Result |
|---|---|
| Mounted before first visit | 0 panes on 3 consecutive fresh loads |
| Mounted after first visit, hidden when away | yes |
| Two-model run started, then navigated to Canvas | — |
| Results while `hidden: true`, view never left Canvas | 0 → 1 (~30s) → 2 (~110s) |
| Run completed without returning to the pane | yes |

`npm run verify:release` passes, including all 3 Playwright e2e tests.

**Two measurement mistakes worth recording**, both from reading the DOM in the same
synchronous `page.evaluate` that had just clicked:

1. "Pane is mounted before first visit" — not reproducible; 3 clean loads showed 0.
2. "Deselecting models did not take" — it had; the readout was pre-re-render.

Both would have become false claims if the first reading had been trusted.

**Note:** an earlier run only established that state *survived* navigating away, not that
work *progressed* while hidden. The table above is from a second run built specifically to
show progression, because the weaker evidence did not support the claim being made.

### 2026-08-31 — Step 7: both comparisons in one Compare pane

`CompareModelsModal` joined it as a second tab rather than becoming a sixth rail item.
They are the same activity — run one input across N models and compare — and they already
shared a stylesheet. Rail items are destinations, not features.

| Tab | Input | Output |
|---|---|---|
| Generation | a brief | N architectures |
| Validation | the current diagram | N validations |

Both tabs stay mounted; only the visible one is painted. Toolbar *Compare Models* and
*Compare Validation* both route here with the right tab, via `compareTab` in
`appViewStore`.

**Only one comparison may run at a time.** Each tab reports its running state up; the
idle tab's run button is disabled with a reason in the tooltip, and the running tab shows
a spinner in the tab strip.

**The bug predicted before writing any code, and fixed.** `onCaptureBatch` renders each
generated architecture on the *real* canvas and captures it. Behind the Compare pane the
canvas is `visibility: hidden` — laid out but not painted — so captures would have come
back blank. `handleCaptureBatch` now switches to Canvas for the batch and restores the
previous view in a `finally`.

**Tested:**

| Check | Result |
|---|---|
| Pane mounted before first visit | 0 |
| Toolbar *Compare Models* → tab | Generation, heading `Compare Models` |
| Toolbar *Compare Validation* → tab | Validation, heading `Compare Validation Across Models` |
| Both tab bodies mounted, one hidden | 2 bodies, 1 hidden |
| Run lock engages | idle tab disabled, `A model comparison is already running` |
| Run lock releases | after completion `title: null`; still disabled only for its own `0 services` reason |
| Generation run end to end | Grok 4.1 Fast 5.3s / Mistral Large 3 11.5s, 2 apply buttons |

`npm run verify:release` passes, including all 3 e2e tests.

**Three false leads during verification**, all mine, none real bugs:

1. *"Compare Validation button does not switch tab"* — the button is `disabled` with an
   empty canvas and my test had no diagram.
2. *"Lock never releases"* — the validation run was genuinely still going; GPT-5.1 ran
   past 11 minutes. Release was then proven with two fast non-reasoning models.
3. *"Toolbar button missing"* — the toolbar is canvas-only now, so it does not exist from
   inside the Compare pane. Working as designed.

**Gap in the per-step checks:** deleting `CompareValidationPane.css` while its import
remained passed both `typecheck` and `lint` — neither resolves CSS imports. Only the dev
server caught it, as a blank page. Run a build, not just typecheck and lint, after
deleting any asset.

### 2026-08-31 — Generation tab guidance and readability

The Validation tab opened with a paragraph explaining itself; Generation opened with a
bare model grid. Added a matching intro, and labelled the three sample rows
(Quick starts / Detailed scenarios / AI workloads).

The prompts were unreadable for two reasons, not one: `0.75rem` **and**
`white-space: nowrap`, so a 200-character example rendered as a single strip. They now
wrap inside a bounded width at `0.8125rem`.

**Third instance of the header-scoped styling trap.** `.compare-run-btn` and
`.compare-apply-btn` inherit `.btn-primary`, which is a white background with blue text
because it was built for the blue header. On a light pane the primary actions read as
ghosted. Both now use a filled treatment with an explicit disabled state, verified in
both themes.

### 2026-08-31 — Regression: Compare pane stayed in the layout

Reported from live use, not caught by the step 7 checks.

`CompareValidationPane` used to hide its own wrapper. When it became a tab inside
`ComparePane`, the wrapper lost that responsibility and nothing took it back — so once
mounted the pane remained a flex child of the workspace, leaving compare content on
screen with the canvas squeezed beside it.

**Why the tests missed it:** every step 7 assertion was made while sitting *on* the
Compare pane — tab bodies, mounting, routing, the run lock. None navigated back to Canvas,
which is the only place the bug is visible. When a change is about *hiding* something,
assert from the place it should be hidden.

| | Canvas width | Compare pane |
|---|---|---|
| Before first visit | 1755px | not mounted |
| On Compare | hidden | visible |
| Back on Canvas | 1755px | mounted, hidden |

Tab selection and a typed prompt both survive the round trip.

**Standing note:** four elements now participate in mount-and-hide — the canvas, the
Compare wrapper, and two tab bodies. Each needs an explicit owner for its hidden state,
and this is the second bug caused by one lacking it. If a fifth appears, extract a shared
hideable wrapper rather than repeating the class dance again.

### 2026-08-31 — Tier 1 toolbar reduction, 22 controls to 19

Removed only what a pane now owns outright:

| Removed | Now reachable at |
|---|---|
| Compare Models | rail → Compare → Generation |
| Compare Validation | rail → Compare → Validation |
| Dark mode toggle | Settings → Appearance |
| Export **dropdown** (14 items) | Reports pane |

Export stayed as a *signpost* — one button, same word, same place, navigating to Reports
instead of opening a menu. Deleting a long-used entry point outright is the part of this
that annoys without looking broken.

Also caught: the guided journey's *Share or Build → Share* called `setIsExportMenuOpen(true)`
on a menu that no longer exists, which would have been a silent dead end. It routes to
Reports now, verified end to end.

**The e2e suite found a real bug, not a test break.** After the change, clicking the
Canvas rail item timed out — a React Flow node inside `.canvas-container.is-hidden` was
intercepting the click.

Root cause is sharper than the earlier hide-state notes suggested: the container had
*both* `visibility: hidden` and `pointer-events: none`, and React Flow defeats both by
setting `visibility: visible` and `pointer-events: all` on every node. A descendant can
override either guard. Because the hidden canvas is `position: absolute; inset: 0` inside
`.workspace`, and the rail is also inside `.workspace`, those invisible-but-live nodes sat
over the rail.

Fixed with `opacity: 0` — which a child cannot undo, unlike visibility — plus
`pointer-events: none !important` on descendants. Verified the rail is hit-testable at
three corners while a pane is open, and that clicking back to Canvas works.

`npm run verify:release` passes, including all 3 e2e tests.

**Revised standing note:** hiding a subtree is only safe when the child cannot opt back
in. Prefer `opacity: 0` over `visibility: hidden`, and force `pointer-events` on
descendants, wherever a third-party library controls child styles.

### 2026-08-31 — Tier 2 toolbar reduction, 19 controls to 17

**Import Template + Import from Azure → one `Import ▾`.** Both mean "start from something
that already exists". The file input moved inside the menu item, so template upload still
works without a separate control.

**Deployment Guide → the Reports pane.** It produces a document, so by the placement rules
it belongs with the other artifacts. Added a `deployment` group to the shared
`ExportAction` list rather than inventing a parallel mechanism, so the toolbar and pane
still cannot drift.

**Tested end to end**, including the slow path:

| Check | Result |
|---|---|
| Toolbar controls | 19 → 17 |
| Import menu | `Template file` + `From Azure`, file input intact |
| Reports sections | images, documents, editable, cost, **Deployment**, recent |
| Generate from the pane | real run; card became `Generating guide…`, disabled `Already generating` |
| After completion | `View Last Deployment Guide` went from blocked to enabled |

`npm run verify:release` passes, including all 3 e2e tests.

**Measurement caution worth recording:** mid-run readings looked like two bugs — the
Generate card "disappearing" and View staying blocked. Both were simply the in-progress
state; the guide took several minutes to return, matching the slow model responses seen
during the Compare work. Waiting for completion rather than trusting the first reading
turned two false bug reports into a clean pass.

### 2026-08-31 — Tier 3: floating canvas toolbar, and a single-row header

Layout, Select, Style, Focus and Collapse Groups act on canvas objects, so they moved onto
the canvas. **Row 2 then held only Validate Architecture, which merged into row 1 — the
header is now a single row.**

**Placement was measured, not guessed.** On a 2689 × 1110 canvas the bottom ~300px is
occupied across its full width by the zoom controls, title block, legend and minimap. The
top edge is free apart from transient occupants: the nav hint (top-right) and prompt
banner (top-centre). Top-left it is; verified no overlap with any of them, and the bar
still fits at a 1091px canvas.

**Portalled, not moved.** The five controls are ~260 lines of dropdown markup with
outside-click wiring. `createPortal` puts them on the canvas while the JSX and all its
handlers stay put, so the change is two edits at the boundary rather than a risky cut.

**Side effect caught by the e2e suite, not by my own check.** The first attempt made
`.canvas-container` the positioned ancestor. That silently re-parented the prompt banner's
coordinate space and broke its drag by exactly the rail + palette width.

My "no side effects" verification had compared the overlays before and after and found
them byte-identical — but the prompt banner only appears after a generation, so it was
never in the sample. **Comparing what happens to be on screen is not the same as comparing
what exists.**

Fixed by hosting the portal target inside React Flow's own container, which is already
positioned, and reverting `.canvas-container`.

| Check | Result |
|---|---|
| Header rows | 2 → **1** |
| Header controls | 17 → 12, plus 5 on the canvas |
| Bar position | top 12, left 12 |
| Overlap with legend / minimap / controls / title block | none |
| Fits at 1091px canvas | yes |
| Layout ▸ Apply Layout from the bar | node positions changed |
| Dropdown direction | opens downward, stays inside the canvas |
| Light and dark | both verified |

`npm run verify:release` passes, including all 3 e2e tests.

**Toolbar across the whole exercise: 22 → 12 in the header**, with five relocated to the
canvas and the rest reachable from the panes that own them.

### 2026-09-01 — Add Group joins the canvas bar, Validate moves next to Guided Chat

Two placements, and one bug the first placement exposed.

**Add Group** creates a canvas object, so it belongs with the other five under the same
rule. It sits next to Collapse Groups, which is its natural pair — adding a group is also
the only way to make Collapse Groups do anything, and the button enables the moment you
use it.

**Validate Architecture** was stranded at the far right, after Export and the reset icon,
purely because it was the last survivor of the deleted row 2. It now sits between Guided
Chat and Help, where the other whole-diagram AI actions are. The "Validation: Good"
follow-up button moved with it so the pair stays together.

Header 12 → 11. Canvas bar 5 → 6.

**The bug: the prompt banner was covering the canvas toolbar.** The banner is centred at
the top of the canvas with `z-index: 1000`; the bar is at top-left with `z-index: 5`. On a
wide screen they miss each other. As the window narrows, the centred banner slides left
until it lands on the bar — and being 200 layers above it, it does not just overlap, it
makes Layout, Select and Style unclickable.

| Canvas width | Banner left edge | Bar right edge | Overlap |
|---|---|---|---|
| 2679 | 1039 | 728 | no |
| 2184 | 792 | 728 | no |
| 1757 | 579 | 728 | **yes** |
| 1544 | 472 | 728 | **yes** |
| 1331 | 365 | 728 | **yes** |

This was **not** introduced by Add Group. Yesterday's five-button bar ended at 616, so the
same collision started at 1832 instead of 2056 — it was already there on any laptop-width
window, and yesterday's "fits at 1091px" check missed it because it measured whether the
bar *fits*, not whether anything *lands on it*. The banner only exists after a generation,
so once again it was absent from the sample.

**Fix:** banners now stack below the bar instead of over it (`CANVAS_BANNER_TOP`). This is
the pattern the layout hint already used — it measures the banner's bottom edge and sits
under it. The stack is now bar → banner → hint, and it holds at every width tested.

| Check | Result |
|---|---|
| Bar bottom / banner top at 1331, 1544, 1757, 2184 | 59-60 / 68 — clear at all four |
| Add Group from the bar | groups 0 → 1, Collapse Groups became enabled |
| Header order | Guided Chat → **Validate Architecture** → Help, same group |
| Validate enabled with nodes present | yes |
| Bar wraps to 2 lines | no, down to the narrowest width tested |
| Header height at 2560 / 1920 | 39px — single line |

`npm run verify:release` passes, including all 3 e2e tests.

**Next:** step 4 — decompose the toolbar behind the seams now that they exist.

### 2026-09-01 — Export beside Import, and "Start fresh" was not starting fresh

Export now sits directly right of Import, in the same group. They are the two ends of the
same idea and were three groups apart.

**The reset was the real find.** Arturo suspected the reset button did not clear the
session the way a browser refresh does. It did not. There is no autosave anywhere in the
app, so a refresh means an empty canvas with only saved preferences surviving — that is
the bar the button has to meet, and it was clearing nodes, edges, the generation session,
validation, the deployment guide and the title block, but leaving eight other things
behind:

| Left behind | What you would have seen |
|---|---|
| Guided Chat conversation and draft | Yesterday's conversation waiting in a "fresh" session |
| Source model name | Exports still filenamed after the model that built the old diagram |
| Reference image | Old sketch still attached |
| Prompt banner position | Next banner appears wherever you dragged the last one |
| Highlighted services | Stale glow with nothing to point at |
| Focus mode | Panels still hidden |
| Collapse-groups toggle | Button stuck reading "Expand Groups" with no groups |
| Validation dock / guide modal open | Dock open over an empty canvas |

The chat one is the subtle one. The panel returns `null` when closed, so it vanishes from
the DOM — but the element is always rendered by `App`, so the **component stays mounted
and keeps its state**. Measured: typed a draft, closed the panel (confirmed gone from the
DOM), reopened it, and the draft was still there. Clearing on close would have been wrong
too, so the panel now takes a `resetSignal` that only the reset bumps.

All of it moved into one `startFreshSession` callback with the standard it has to meet
written above it, rather than a growing list inside an `onClick`.

| Check after reset | Result |
|---|---|
| Nodes | 0, empty-state chooser shown |
| Prompt banner | gone |
| Chat draft after reopening | empty, back to cold-start starters |
| Focus | back to "Focus" |
| Collapse Groups | back to default label, disabled |
| Validate Architecture | disabled |
| Title block | absent |

`npm run verify:release` passes, including all 3 e2e tests.

**Measurement note.** The first two attempts to test this reported "reset does nothing" —
both were wrong. Playwright auto-dismisses dialogs, so the confirm was being answered
"no", and the handler has to be registered in the same call as the click. Then a real
click was silently intercepted by the chat panel. Neither was an app bug; both looked
exactly like one.

**Found while testing, not fixed:** the Guided Chat panel is `position: fixed; top: 0` at
`z-index: 1100`, so it covers the right end of the header. With chat open, **Load and the
reset button cannot be clicked** — a genuine real click is intercepted, which is how it
surfaced. The `body.has-validation-dock` offset pattern already in this codebase would fix
it; left for a placement decision.
