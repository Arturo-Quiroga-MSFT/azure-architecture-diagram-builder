# Help & Learn — In‑App Guidance Plan

This document captures the phased plan for adding in‑app learning and "how to use"
guidance to the Azure Architecture Diagram Builder. It exists so the work can be
picked up incrementally without losing the original intent.

## Goals

- Reduce "how do I…?" friction now that the tool has 250+ users.
- Teach the feature set in‑context (Generate, Chat, Validate, Cost, Deployment
  Guide, Avatar) without sending users out to external docs.
- Provide a measurable surface so the workbook can show whether guidance is used —
  useful evidence for the "productize this" conversation.

## Constraints (current architecture)

- Single‑view SPA: one `App.tsx` with the React Flow canvas plus modals/panels.
- **No router** today (no `react-router-dom` dependency).
- **No markdown renderer** dependency — the app renders structured JSX/components,
  not raw markdown. Help content is authored as JSX to avoid a new dependency.
- nginx and Vite both do SPA fallback (`try_files … /index.html`), so client‑side
  routing *would* work later without server changes.

## Phase 1 — Help & Learn panel (no routing) ✅ in progress

A toolbar **Help (?)** button opens a centered overlay with a left section nav and
scrollable content. Sections:

- **Quick Start** — three steps to a first diagram.
- **Feature Tour** — annotated list: AI generation, Architecture Chat, Image
  import, Blueprint, WAF validation, Multi‑model compare, Cost estimation,
  Deployment guides (Microsoft Learn–grounded), Avatar presenter, Version history.
- **Example Prompts** — copy‑ready prompts spanning simple to enterprise.
- **Tips & FAQ** — practical guidance and common questions.
- **Resources** — links to the blog post and key docs.

Supporting work:

- Telemetry: `Help_Opened` event (with the active section) so the cost/usage
  workbook can report engagement.
- First‑run nudge: a subtle pulse on the Help button, gated by `localStorage`.

Rationale: highest value for least effort, zero architectural change, consistent
with the existing modal/panel pattern.

## Phase 2 — Promote to a real `/learn` route (optional)

If shareable deep links or a growing knowledge area are wanted:

- Add `react-router-dom`, wrap the app shell, add a `/learn` route.
- Add a small top‑nav toggle (Canvas ⇄ Learn).
- Reuse the Phase 1 content components verbatim inside the route.
- No server change needed (SPA fallback already in place).

Trade‑off: introduces routing to a previously router‑free app and a small shell
refactor, in exchange for `/learn` deep links and room for more pages
(Changelog, Gallery).

## Phase 3 — Guided product tour (optional)

A first‑run walkthrough that highlights toolbar controls in sequence.

- Either a library (e.g., `react-joyride`) or a custom coachmark reusing the
  existing canvas‑highlight logic.
- Auto‑launch on first visit, gated by `localStorage`; re‑launchable from the
  Help panel.

Trade‑off: highest onboarding "aha," but more design effort and ongoing
maintenance as the toolbar evolves.

## Content sources

- [DOCS/getting-started-guide.md](getting-started-guide.md)
- README feature sections
- The published TechCommunity blog post
- The example prompts already shipped in the AI generator

## Measurement

- `Help_Opened` (and per‑section views) feed the App Insights workbook.
- Optional later: correlate Help usage with successful first generation.
