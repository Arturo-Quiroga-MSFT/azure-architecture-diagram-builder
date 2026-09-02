# Phase 1 and Phase 2 Control Inventory

- Date: 2026-09-01
- Branch: `engineering/hve-sdlc-phase-1-2`
- Status vocabulary: `Automated`, `Documented`, `Repository setting required`,
  `Named reviewer required`

## Controls

| Control | Status | Evidence or remaining action |
| --- | --- | --- |
| R0-R4 risk classes and protected surfaces | Documented | `HVE-ADOPTION/phase-0/03-change-risk-classes.md` and `02-ownership-and-protected-surfaces.md` |
| Definition of Ready, Definition of Done, stop conditions | Documented | `HVE-ADOPTION/SDLC.md` |
| HVE RPI primary; Spec Kit selective | Documented | ADR-0002 |
| Repository-wide agent lifecycle instructions | Documented | `.github/copilot-instructions.md`; guidance is not deterministic enforcement |
| Testing and release agent instructions | Documented | `.github/instructions/*.instructions.md`; frontmatter parsed locally |
| Structured bug and feature intake | Automated | GitHub issue forms parse as YAML; becomes available when merged to default branch |
| Protected-surface owner routing | Automated | `.github/CODEOWNERS`; routing is not independent review |
| PR evidence fields and placeholders | Automated | `scripts/validate-pr-governance.mjs`; 4 valid and 7 invalid fixture cases pass |
| PR evidence status check | Automated | `.github/workflows/pr-governance.yml`; requires ruleset after merge |
| Review readiness information ordering | Automated | PR template leads with blockers, discoveries, deviations, limitations, and decision; validator enforces presence/order |
| Draft-to-review readiness | Automated | Non-draft PR fails unless `ready`/`acknowledged`; CI cannot prevent the GitHub state change itself |
| Product release gate | Automated | `.github/workflows/quality.yml` runs `npm run verify:release` |
| Clean-checkout token-server dependencies | Automated | Quality and deployment workflows run `npm ci --prefix server`; correlation contract passes |
| Local production source provenance | Automated | Guard requires clean `main` equal to `origin/main` |
| Local production approval | Automated | Human must type `deploy v<version> to azure-diagram-builder-vnet` before Azure commands |
| GitHub version-specific deployment input | Automated | Manual workflow input must equal package version |
| GitHub production environment | Repository setting required | Environment is absent (API returned 404); create after PR acceptance |
| Production environment human approval | Named reviewer required | Name backup release reviewer before enabling `prevent_self_review`; Arturo remains interim operator |
| PR-only `main` and required checks | Repository setting required | No active ruleset observed; after merge require `Build (Vite app)`, `Build (MCP server)`, `verify-release`, and `Validate lifecycle evidence` |
| Independent R2 review | Named reviewer required | Solo-maintainer exception remains allowed only with recorded reason, exact validation, and residual risk |
| Independent R3 review | Named reviewer required | Required by accepted Phase 0; AI review does not satisfy it |
| R4 external authority | Named reviewer required | Cannot be self-exempted; Impact Privacy/CELA gate remains unresolved |
| Immutable artifact and rollback evidence | Documented | Required by SDLC and existing deploy script; release-specific evidence remains per release |
| Post-deployment exact behavior verification | Documented | Required by SDLC; health/version alone are insufficient |

## Validation Evidence

- Accepted Phase 0 files copied byte-for-byte from the maintainer's previously
  ignored workspace and made trackable.
- Independent plan critique: initial `Revise`, then `Pass` after seven amendments.
- All workflow and issue-form YAML parsed successfully.
- Both instruction frontmatter files parsed and contain descriptions.
- PR validator: 4 valid and 7 invalid cases passed.
- Production approval guard: valid, wrong phrase, wrong branch, dirty source, and
  source not synchronized with `origin/main` passed.
- `npm run test:deterministic`: 17 checks passed after installing both lockfiles.
- Prompt-banner drag gate: old behavior failed at 14.58px; intermediate fixes
  measured 7/10 and 9/10; explicit final pointer delivery plus eventual render
  assertion passed 10/10 while preserving the 1px contract.
- Final `npm run verify:release`: 17 deterministic checks and 3/3 browser tests
  passed in one execution.

## Findings and Residual Risk

1. Root `npm ci` reports 26 known dependency findings: 1 low, 4 moderate, 19 high,
   and 2 critical. The server manifest reports zero. This governance change does
   not modify dependencies; dependency triage is a separate R3 security task.
2. `test:production-exclusions` requires a prior build because it inspects `dist/`.
   The authoritative gate already runs build first; standalone deterministic runs
   must preserve that precondition.
3. The Phase 0 baseline is historically accurate for 2026-08-14 but now stale in
   places: quality CI and release notes exist. It remains a dated baseline, while
   this inventory records current controls.
4. Repository settings cannot be safely activated before the workflows and
   CODEOWNERS are accepted into the default branch. Phase 2 source implementation
   is complete only after this PR; operational enforcement requires the two
   settings actions listed above.
