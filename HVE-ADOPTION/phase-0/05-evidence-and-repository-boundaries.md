# Evidence and Repository Boundaries

Status: **Accepted as interim governance on 2026-08-14**

## Public Repository Rule

The AADB repository is public. A file is eligible for commit only when its
content and metadata are suitable for unrestricted public disclosure.

Public-safe does not mean merely "contains no password." Resource identifiers,
internal URLs, reviewer identity, partner/customer context, telemetry extracts,
and security findings can also be inappropriate for public storage.

## Placement Matrix

| Artifact | Public AADB repository | Private quality-engineering repository or approved storage | Local ignored workspace only |
| --- | --- | --- | --- |
| Product source and public contracts | Yes | Mirror only when needed for immutable evaluation | No |
| Fast deterministic regression fixtures | Yes, sanitized | Optional | No |
| Public architecture/evaluation methodology | Yes | Optional | No |
| Generated model captures | Small sanitized samples only | Yes | Yes during active work |
| Blinded human review queue | Only if content is synthetic, public-safe, and reviewer identity absent | Preferred | Yes during review |
| Reviewer identity and notes | No | Yes, access controlled | Yes temporarily |
| Customer or partner prompts/designs | No unless explicitly approved and anonymized | Approved protected storage | Yes temporarily |
| Raw telemetry or user-level event extracts | No | Approved privacy-controlled storage | Yes temporarily |
| Aggregate privacy-safe product metrics | Yes when substantiated and approved | Yes | Yes during analysis |
| Privacy/CELA review packet | No | Approved internal system/storage | Yes |
| Threat models and sensitive findings | Public summary only when safe | Yes | Yes during active review |
| Secrets, tokens, credentials | Never | Managed secret store, not Git | Local secret files only |
| Azure resource configuration snapshots | Sanitized templates only | Protected artifact storage | `.backups/` locally |
| Large run bundles, screenshots, PPTX/PDF outputs | Curated public deliverables only | Preferred | Yes during active work |
| Durable HVE/RPI records | Yes when public-safe | Use private repo for sensitive workstreams | Yes until classified |

## Required Metadata for Durable Engineering Evidence

Where applicable, evidence should record:

- Task or work-item identifier
- AADB commit SHA and branch
- Dirty-worktree state
- Requirements and acceptance criteria
- Contract, dataset, evaluator, or artifact hash
- Exact commands executed
- Exact scoped outcomes
- Checks not run and why
- Reviewer and approval status without exposing private identity publicly
- Residual risks and follow-up owner
- Deployment artifact digest and rollback reference

## Claim Discipline

Use explicit language:

- **Tested:** directly observed by the cited command or check.
- **Measured:** quantified over the stated population and window.
- **Documented:** stated by an authoritative source but not independently tested here.
- **Inferred:** reasoned from evidence and clearly labeled as inference.
- **Proposed:** not yet implemented or approved.

The subject, scope, and population of a claim must match the evidence. A passing
test for one model, region, endpoint, or revision must not be generalized to all
models, regions, endpoints, or revisions.

## Boundary Decisions Still Required

| Decision | Owner | Target |
| --- | --- | --- |
| Name and create the private quality-engineering repository | AADB maintainer | V2/V3 evaluation boundary |
| Select approved storage for large evaluation artifacts | AADB maintainer and privacy/security authorities | Before migration |
| Define retention for generated run artifacts | Quality owner, TBD | Before private-repo rollout |
| Define public redaction checklist | AADB maintainer | Phase 1/2 |
| Decide whether `.copilot-tracking/` is tracked by default | AADB maintainer | Before Phase 3 pilot |
