# Design Item: WAF Pillar Maturity View

> Reframe architecture validation results away from a single numeric score toward a per-pillar maturity view, with the numeric score made optional and off by default.

**Status:** Implemented
**Branch:** `feature/waf-pillar-maturity-view`
**Date:** 2026-06-04
**Owner:** Arturo Quiroga
**Source:** Feedback from Ben Brauer and Chris DePalma, technical-workshop review meeting (June 3, 2026)

---

## 1. Background and Motivation

During the June 3, 2026 review with Ben Brauer's team, the architecture validation
agent was well received, but the **numeric scoring** drew specific, actionable critique:

- **Chris DePalma:** Scoring can be problematic. Users may misinterpret a number or
  take offense at a low score, especially when the score reflects a *diagram-only*
  heuristic rather than an audit of their real environment.
- **Ben Brauer:** Questioned whether a numeric score belongs in the UI at all, and
  asked what value it adds beyond the findings themselves.

The decision was **not to drop scoring**, but to **reframe it**:

1. Lead with a **per-pillar maturity view** using qualitative bands instead of a
   bare number.
2. Emphasize **gaps identified** (findings by severity) as the primary signal.
3. Make the **numeric score optional and toggleable**, off by default.

This aligns with the existing positioning in
[WAF-SCORING-METHODOLOGY.md](WAF-SCORING-METHODOLOGY.md): the score is a
"directional design-time signal," not a certification.

---

## 2. Goals and Non-Goals

### Goals

- Replace the prominent `overallScore/100` and `pillar.score/100` displays with
  qualitative **maturity bands**.
- Surface a **gaps-identified summary** (counts by severity) per pillar and overall.
- Add a user-controllable **"Show numeric score"** toggle, defaulting to off.
- Keep the underlying numeric model intact so existing logic, telemetry, model
  comparison, and reports continue to function.

### Non-Goals

- Changing the validation pipeline, prompts, or how scores are computed
  (the two-phase hybrid validator is unchanged).
- Removing scores from the comparison feature's ranking logic (the model
  comparison still needs a numeric basis to rank reviewers).
- Re-architecting the markdown report format beyond adding band labels.

---

## 3. Current State (as built)

| Concern | Location |
|---|---|
| Validation data model (`overallScore`, `pillars[].score`) | [src/services/architectureValidator.ts](src/services/architectureValidator.ts) |
| Main results UI (circular score, per-pillar `score/100`) | [src/components/ValidationModal.tsx](src/components/ValidationModal.tsx) |
| Toolbar badge `Validation {overallScore}/100` | [src/App.tsx](src/App.tsx) |
| Multi-model comparison (per-model score circles, ranking) | [src/components/CompareValidationModal.tsx](src/components/CompareValidationModal.tsx) |
| Markdown report (`Overall Score`, pillar table) | `formatValidationReport()` in [src/services/architectureValidator.ts](src/services/architectureValidator.ts) |
| Telemetry (`overallScore`, `findingCount`) | [src/services/telemetryService.ts](src/services/telemetryService.ts) |

The numeric color helper `getScoreColor()` and the report-level emoji bands
(🟢/🟡/🔴) already encode an implicit banding scheme that this design formalizes.

---

## 4. Proposed Maturity Band Model

Internally, scores remain `0-100`. A shared mapping converts a score to a band.
Bands are chosen to be **descriptive, not judgmental**, and to read well even
without a number beside them.

| Band | Score range | Label | Intent |
|---|---|---|---|
| `strong` | 80-100 | Strong alignment | Few or no gaps against WAF best practices |
| `adequate` | 60-79 | Adequate, with gaps | Reasonable foundation; specific improvements identified |
| `developing` | 40-59 | Developing | Several meaningful gaps to address before production |
| `early` | 0-39 | Early / needs attention | Significant gaps; revisit core design choices |

Notes:

- Band thresholds reuse the existing `getScoreColor()` boundaries (80 / 60 / 40)
  so behavior is consistent with what users already see.
- Labels deliberately avoid "good/bad," "pass/fail," and letter grades to reduce
  the risk of offense Chris raised.
- A band is paired with the existing color for continuity, not replaced by it.

### Proposed shared helper

A single source of truth, e.g. `src/services/wafMaturity.ts`:

```ts
export type MaturityBand = 'strong' | 'adequate' | 'developing' | 'early';

export interface MaturityDescriptor {
  band: MaturityBand;
  label: string;   // e.g. "Adequate, with gaps"
  color: string;   // reuse existing getScoreColor() value
}

export function scoreToBand(score: number): MaturityDescriptor { /* ... */ }
```

---

## 5. Gaps-Identified Summary

The primary at-a-glance signal becomes **gaps identified**, derived from existing
findings (no new data required):

- **Per pillar:** count of `findings` grouped by severity
  (`critical`, `high`, `medium`, `low`).
- **Overall:** total findings across all pillars plus the count of quick wins.

Example pillar row (numeric score hidden):

```text
Reliability   Adequate, with gaps   ·   2 high · 1 medium gap
```

Example overall summary:

```text
Overall: Adequate, with gaps  ·  9 gaps identified (1 critical, 3 high, 5 medium)
```

This makes findings — the actionable part — the headline, which directly answers
Ben's "what does the number add?" question.

---

## 6. Optional Numeric Score (toggle)

- Add a boolean UI preference, e.g. `showNumericScore`, defaulting to **false**.
  - Suggested home: a small settings/preferences store (or extend the existing
    settings store used by the model selector). It is a UI display preference,
    not a model parameter.
  - Persist to `localStorage` so the choice survives reloads.
- When **off** (default):
  - `ValidationModal` shows the maturity band + gaps summary; no `/100`.
  - Toolbar badge reads e.g. `Validation: Adequate` instead of `Validation 72/100`.
  - Markdown report leads with the band; the number is omitted or parenthetical.
- When **on**:
  - Restore the numeric `/100` alongside the band (band first, number secondary).
- The toggle lives in the validation modal header (a quiet control) and/or global
  settings, so power users can opt back in without code changes.

---

## 7. UI Changes by Surface

### 7.1 ValidationModal ([src/components/ValidationModal.tsx](src/components/ValidationModal.tsx))

- Replace the circular `score-circle` value with the **maturity band** as the
  primary element; keep the conic-gradient ring (driven by the internal score)
  for visual continuity, but render the **band label** in the center instead of
  the number when the toggle is off.
- Under "Five Pillars Assessment," replace `{pillar.score}/100` with the band
  label plus the per-pillar gaps summary chips.
- Keep all findings, severities, quick wins, and "apply recommendations"
  behavior unchanged.

### 7.2 Toolbar badge ([src/App.tsx](src/App.tsx))

- Change `Validation {validationResult.overallScore}/100` to
  `Validation: {bandLabel}` (with number appended only when the toggle is on).

### 7.3 CompareValidationModal ([src/components/CompareValidationModal.tsx](src/components/CompareValidationModal.tsx))

- Display bands on each model card and in per-pillar rows.
- **Keep the numeric score for ranking** (`highestScore`, ⭐ best model). Ranking
  is an internal comparison, not a user-facing judgment of *their* architecture,
  so the number can remain here, optionally shown as a small secondary value.

### 7.4 Markdown report (`formatValidationReport()`)

- Executive summary leads with band label; show `Overall Score: N/100` only when
  the numeric toggle is enabled (or always include it in the *downloaded report*
  for completeness while hiding it in the live UI — decision below).
- Pillar table "Status" column already exists; relabel its values to the new band
  vocabulary for consistency.

---

## 8. Data, Telemetry, and Compatibility

- **Data model unchanged.** `overallScore` and `pillar.score` remain in
  `ArchitectureValidation`. Bands are derived, not stored, so existing saved
  validations, version history, and comparisons keep working.
- **Telemetry unchanged.** Continue sending `overallScore` and `findingCount`
  ([telemetryService.ts](src/services/telemetryService.ts)); optionally add a
  derived `maturityBand` dimension for analytics.
- **Backward compatible.** No migration needed; this is a presentation-layer
  change plus one UI preference.

### Open decision

> Should the **downloaded markdown report** always include the numeric score
> (for archival completeness) even when the live UI hides it, or honor the same
> toggle? **Resolved:** the downloaded report always includes the numeric signal
> for archival completeness; only the live UI hides it by default.

---

## 9. Implementation Checklist

- [x] Add `src/services/wafMaturity.ts` with `MaturityBand`, `scoreToBand()`, and a
      `summarizeGaps(findings)` helper.
- [x] Add `showNumericScore` UI preference (store + `localStorage`, default false).
- [x] Update `ValidationModal.tsx` (overall band, per-pillar bands, gaps chips,
      header toggle).
- [x] Update toolbar badge in `App.tsx`.
- [x] Update `CompareValidationModal.tsx` (bands on cards/rows; keep ranking number).
- [x] Update `formatValidationReport()` band vocabulary and conditional number.
- [x] Add minimal styles for band chips and gaps summary
      (`ValidationModal.css`, `CompareValidationModal.css`).
- [x] Update [WAF-SCORING-METHODOLOGY.md](WAF-SCORING-METHODOLOGY.md) and
      [WAF-SCORING-FAQ.md](WAF-SCORING-FAQ.md) to describe bands and the toggle.

---

## 10. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Bands feel vaguer than a number to some users | Pair band with the gaps summary; offer the numeric toggle for those who want it |
| Comparison ranking loses precision if number hidden | Keep numeric score in the comparison/ranking path; only soften the per-architecture headline |
| Inconsistent vocabulary across UI and report | Centralize labels in `wafMaturity.ts`; reuse everywhere |
| Hidden score breaks existing screenshots/docs | Update methodology + FAQ docs in the same change |

---

## 11. Validation / Acceptance

- Numeric `/100` no longer appears in the live UI by default (modal, toolbar,
  per-pillar rows).
- Each pillar and the overall result show a maturity band plus a gaps-identified
  summary.
- Enabling "Show numeric score" restores numbers everywhere they appeared before.
- Model comparison still ranks models correctly and marks the best with ⭐.
- Downloaded report renders bands and remains a valid, complete artifact.
- Methodology and FAQ docs reflect the new vocabulary.

---

## 12. Follow-ups (out of scope for this item)

- Consider a per-pillar trend indicator across re-validations (improved / regressed).
- Revisit whether the comparison ranking should also adopt band-first display once
  bands are validated with users.
