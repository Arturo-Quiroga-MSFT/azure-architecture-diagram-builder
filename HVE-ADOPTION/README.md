# AADB HVE-Inspired SDLC Adoption

## Purpose

This directory records the incremental adoption of a repository-owned software
delivery lifecycle inspired by [Microsoft HVE Core](https://github.com/microsoft/hve-core).
HVE Core is a source of patterns and learning. It is not a runtime, build, or
production dependency of AADB.

The governing principle is:

> Conventional SDLC controls remain authoritative. HVE Research, Plan,
> Implement, and Review practices make AI-assisted work repeatable, bounded,
> and evidence-based.

## Current Scope

Phase 0 was accepted on 2026-08-14. On 2026-09-01 the maintainer approved Phase
1 instructions and Phase 2 governance enforcement after an introspection of
repeated regressions and premature release decisions.

[The AADB SDLC](SDLC.md) is now the authoritative operational lifecycle. It
keeps HVE Research, Plan, Implement, Review, and Follow-up distinct, uses Spec
Kit selectively for substantial product definition, and preserves conventional
PR, CI, approval, release, and rollback controls as authoritative.

## Phase 0 Artifacts

| Artifact | Purpose | Status |
| --- | --- | --- |
| [stage1.md](stage1.md) | Original adoption proposal | Source input |
| [phase-0/00-charter-and-exit-criteria.md](phase-0/00-charter-and-exit-criteria.md) | Scope, principles, and completion criteria | Complete |
| [phase-0/01-current-state-baseline.md](phase-0/01-current-state-baseline.md) | Evidence-based current lifecycle inventory | Complete |
| [phase-0/02-ownership-and-protected-surfaces.md](phase-0/02-ownership-and-protected-surfaces.md) | Interim ownership and sensitive change surfaces | Accepted |
| [phase-0/03-change-risk-classes.md](phase-0/03-change-risk-classes.md) | Risk classes and minimum evidence expectations | Accepted |
| [phase-0/04-known-exceptions-and-technical-debt.md](phase-0/04-known-exceptions-and-technical-debt.md) | Baseline exceptions and debt register | Complete baseline |
| [phase-0/05-evidence-and-repository-boundaries.md](phase-0/05-evidence-and-repository-boundaries.md) | Public/private artifact placement rules | Accepted |
| [decisions/0001-adopt-repository-owned-hve-inspired-sdlc.md](decisions/0001-adopt-repository-owned-hve-inspired-sdlc.md) | Foundational adoption decision | Accepted |

## Phase 1 and Phase 2 Artifacts

| Artifact | Purpose | Status |
| --- | --- | --- |
| [SDLC.md](SDLC.md) | Lifecycle, risk gates, Ready/Done, stop conditions, evidence and release authority | Authoritative |
| [phase-1-2/implementation-plan.md](phase-1-2/implementation-plan.md) | Approved implementation scope and acceptance criteria | In progress |
| [phase-1-2/plan-critique.md](phase-1-2/plan-critique.md) | Independent plan critique and re-review | Pass |
| [phase-1-2/changes.md](phase-1-2/changes.md) | Material changes, divergences, validation and checks not run | Ready for review |
| [phase-1-2/control-inventory.md](phase-1-2/control-inventory.md) | Automated, documented, setting-dependent and reviewer-dependent controls | Ready for review |
| [decisions/0002-use-hve-rpi-with-selective-spec-kit.md](decisions/0002-use-hve-rpi-with-selective-spec-kit.md) | HVE-primary and selective-Spec-Kit decision | Accepted |

## Evidence Language

Phase 0 uses these labels deliberately:

- **Observed**: verified directly in the repository or its configured remote.
- **Documented**: stated in an existing repository artifact or official HVE guidance.
- **Proposed**: a future policy or ownership assignment that is not yet enforced.
- **TBD**: an accountable human or approval authority has not been confirmed.

## References

- [HVE Core documentation](https://microsoft.github.io/hve-core/)
- [HVE RPI workflow](https://microsoft.github.io/hve-core/docs/rpi/)
- [HVE team adoption and governance](https://microsoft.github.io/hve-core/docs/customization/team-adoption/)

## Next Decision

Phase 3 may pilot durable RPI change records on one R2 feature after Phase 1 and
Phase 2 acceptance. It is not authorized by the current work.
