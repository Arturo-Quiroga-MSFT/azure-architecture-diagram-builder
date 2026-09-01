# HVE Phase 1 and Phase 2 Implementation Plan

- Status: Draft PR #25 open; independent human R3 review and merge approval pending
- Date: 2026-09-01
- Owner: Arturo Quiroga
- Branch: `engineering/hve-sdlc-phase-1-2`
- Base: `main` at `4be6705` (AADB v2.0.4)

## Decision

AADB will finish the repository-owned, HVE-inspired lifecycle accepted in
ADR-0001. HVE RPI provides the engineering lifecycle. Spec Kit is used
selectively to define substantial product features; it is not installed as a
second mandatory lifecycle or made a build dependency.

The accepted Phase 0 artifacts currently exist only in the maintainer's ignored
workspace. This phase will move the public-safe decision record into version
control before relying on it as repository governance.

## Scope

### Phase 1: authoritative instructions

- Version the accepted Phase 0 baseline and ADR-0001 by removing the obsolete
  `HVE-ADOPTION/` ignore rule and copying the public-safe accepted artifacts.
- Publish one concise lifecycle, Definition of Ready/Done, risk-to-gate matrix,
  evidence language, and stop conditions.
- Add repository-wide Copilot instructions that point to that lifecycle.
- Add focused testing and release instructions for relevant files.
- Record the HVE-primary / selective-Spec-Kit decision in an ADR.

### Phase 2: enforceable governance

- Add a PR template and bug/feature issue forms.
- Add CODEOWNERS for protected surfaces using the accepted interim owner.
- Add a PR policy check that rejects missing risk, acceptance, test, limitation,
  blast-radius, rollback, or approval evidence.
- Keep `npm run verify:release` as the required product gate; do not duplicate it.
- Require deliberate, version-specific production approval in both local and
  GitHub deployment paths. The local script prompts the human to type the exact
  target version before any production mutation. The GitHub workflow requires a
  matching `confirm_version` input and uses the `production` environment; a
  required environment reviewer remains a repository setting.
- Configure `main` to require a PR and passing CI checks after this governance PR
  is accepted; required approvals remain zero until an independent reviewer is
  named, matching the accepted solo-maintainer interim model.

## Non-Goals

- No product behavior changes.
- No edits to the paused `chore/sdlc-phase-1-quality-gates` worktree or branch.
- No wholesale HVE or Spec Kit installation.
- No new model/evaluation policy beyond mapping existing R3 rules to evidence.
- No production deployment.
- No claim that CODEOWNERS provides independent review while the owner authors a
  change.
- No claim that repository instructions are deterministic enforcement.

## Tasks

- `P01-T00`: Version the accepted Phase 0 record and ADR-0001.
- `P01-T01`: Publish the lifecycle and ADR-0002.
- `P01-T02`: Add concise repository and file-scoped agent instructions.
- `P02-T01`: Add PR and issue intake templates plus CODEOWNERS.
- `P02-T02`: Add and test a deterministic PR-evidence validator and workflow.
- `P02-T03`: Add and test production-deployment confirmation guards.
- `P02-T04`: Validate YAML, scripts, product gates, and branch isolation. Repair
  any demonstrated gate defect that prevents a clean checkout from running the
  authoritative gate; record old failure and new evidence rather than retrying.
- `P02-T05`: Produce a control inventory with `Automated`, `Documented`,
  `Repository setting required`, or `Named reviewer required` for every control.
- `P02-T06`: Perform a read-only acceptance review against this plan.
- `P02-T07`: Re-check paused-worktree branch, status, and diff checksum; push a
  review branch and open a PR. Do not merge or deploy.

## PR Evidence Contract

The PR template uses machine-readable single-line fields plus narrative sections:

- `Change type: bug | feature | refactor | docs | operations | governance`
- `Risk class: R0 | R1 | R2 | R3 | R4`
- `Lifecycle: direct | plan | full-rpi | spec-kit-plus-rpi`
- `Independent review: not-required | required-pending | complete | exception`
- `External gate: not-applicable | pending | approved`
- `Merge approval: pending | approved`
- `Production deployment: not-requested | pending | approved`
- Narrative sections: Summary, Acceptance Criteria, Blast Radius, Test Evidence,
  Regression Fence, Limitations / Not Tested, and Rollback.

The validator rejects a missing field, an unrecognized value, an empty narrative
section, or retained placeholders such as `TODO`, `TBD`, and template comments.
For `bug`, Regression Fence must state the old-code failure and new-code pass, or
explain why no executable fence exists. R2+ requires `plan`, `full-rpi`, or
`spec-kit-plus-rpi`; R3/R4 requires `full-rpi` or `spec-kit-plus-rpi`. R4 fails
while External gate is not `approved`. The workflow validates evidence
completeness; it does not claim the evidence is truthful or sufficient.

## Acceptance Criteria

1. A contributor can determine the risk class, required gates, readiness, done,
   stop conditions, and release authority from one authoritative document.
2. Copilot is always told to classify material work, separate lifecycle phases,
   stop on falsified assumptions, and never merge/deploy without explicit
   approval.
3. PRs to `main` fail mechanically when required evidence sections are absent or
   placeholders remain.
4. Existing `verify:release` remains a required CI check and passes unchanged.
5. Local and GitHub production deployment paths require explicit approval tied
   to the intended version; build-only validation remains possible without
   production approval.
6. Protected paths route to the accepted interim owner without claiming
   independent review.
7. The original quality-gates branch retains its two commits and uncommitted
  smoke-spec change untouched; its pre-work diff checksum is
  `11f75eb11d3bb5cbff852542d00cfca43ca0383e700dd56d9c2e97674198c693`.
8. No production code, version, release tag, main branch, or Azure resource is
   changed by this work.
9. A control inventory lists every intended control with one status:
  `Automated`, `Documented`, `Repository setting required`, or
  `Named reviewer required`; the final review verifies each status against
  repository evidence.

## Validation Plan

- Test the PR validator with passing and failing fixture bodies and changed-path
  lists.
- Run YAML parsing or an available workflow linter on all changed workflows and
  issue forms.
- Test deployment guards in non-mutating failure modes before any Azure command
  runs. Do not invoke the approved path or any Azure mutation during this phase.
- Run `npm run verify:release` from the isolated worktree.
- Compare the paused worktree branch, status, commit list, and diff checksum
  immediately before pushing the governance branch.
- Conduct an independent, read-only plan critique before source/governance edits
  and a separate acceptance review after validation.

## Rollback

The work is isolated on a new branch and worktree. Before merge, rollback is
branch deletion. After merge, revert the governance merge commit and remove any
GitHub ruleset created from this plan. No product data migration is involved.
