# Phase 1 and Phase 2 Change Record

- Date: 2026-09-01
- Branch: `engineering/hve-sdlc-phase-1-2`
- Base: `4be6705` (AADB v2.0.4)

## Changes

- `CHG-001`: Made the accepted Phase 0 decision record trackable and copied its
  public-safe artifacts byte-for-byte into version control.
- `CHG-002`: Added the authoritative AADB SDLC, HVE-primary/selective-Spec-Kit
  ADR, and concise repository/file-scoped agent instructions.
- `CHG-003`: Added PR and issue intake templates plus protected-surface
  CODEOWNERS routing.
- `CHG-004`: Added a deterministic PR evidence validator and PR-only workflow.
- `CHG-005`: Added version-specific, source-bound production approval to local
  and GitHub deployment paths.
- `CHG-006`: Made the clean-checkout quality/deployment workflows install the
  token server's own lockfile before running server tests.
- `CHG-007`: Stabilized the existing prompt-banner drag gate without loosening
  its 1px contract.
- `CHG-008`: Added a control inventory separating automated controls from
  settings and named-reviewer dependencies.

## Approved Divergences

- `DIV-001`: Phase 0 was expected in the repository but was ignored local
  material. The plan was revised before implementation to version it first.
- `DIV-002`: Full validation exposed a clean-checkout server dependency gap. The
  plan was amended to allow bounded repair of demonstrated gate defects.
- `DIV-003`: Full validation exposed a known flaky drag assertion. Three
  hypotheses were measured; only explicit final pointer delivery plus eventual
  render assertion achieved 10/10 without weakening the contract.

## Validation

- Phase 0 import: byte-for-byte comparison passed.
- Independent plan critique: `Revise`, amended, re-review `Pass`.
- YAML/frontmatter: all changed workflows, issue forms, and instruction files
  parsed.
- PR evidence validator: 4 valid and 7 invalid fixtures passed.
- Production approval guard: 5 source/approval cases passed without Azure.
- Clean token-server install + correlation contract: passed.
- Expanded deterministic suite: 17 checks passed.
- Drag reliability characterization: final design passed 10/10.
- Complete release gate: 17 deterministic checks and 3/3 browser tests passed.

## Not Performed

- No production deployment or Azure mutation.
- No product version or release tag change.
- No main merge.
- No branch ruleset or production environment setting applied before PR review.
- No dependency remediation; root audit findings are recorded in the control
  inventory for separate security triage.
