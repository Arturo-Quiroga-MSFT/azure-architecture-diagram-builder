# Phase 0 Charter and Exit Criteria

Status: **Complete**

Maintainer confirmation date: **2026-08-14**

## Objective

Create a factual baseline and make the minimum governance decisions needed to
design a repository-owned, HVE-inspired SDLC for AADB.

## In Scope

1. Document the current delivery lifecycle and existing controls.
2. Identify interim owners and protected change surfaces.
3. Define change-risk classes.
4. Record known exceptions and technical debt without silently fixing them.
5. Define the boundary between public repository evidence and private evidence.
6. Record the foundational adoption decision.

## Out of Scope

- Product or runtime changes
- New CI or release gates
- Branch protection changes
- PR templates, issue forms, or CODEOWNERS
- Copilot instructions, agents, prompts, or skills
- Migration of evaluation artifacts
- Privacy/CELA decisions for the pending Impact feature
- Retrospective reconstruction of lifecycle evidence for completed work

## Principles

1. **Human accountability remains explicit.** AI output is evidence or a
   proposal, not approval.
2. **Evidence does not exceed the check performed.** Tested, documented, and
   inferred claims remain distinguishable.
3. **Use the smallest sufficient lifecycle.** Low-risk edits do not require the
   same ceremony as authentication, privacy, pricing, model, or deployment changes.
4. **Fail closed on sensitive boundaries.** Missing privacy, security, or
   evaluation approval blocks the affected release claim.
5. **Public-safe by default.** Durable artifacts in this repository must be
   suitable for a public GitHub repository.
6. **HVE is adapted, not imported wholesale.** AADB owns its process and may
   selectively adopt HVE patterns.

## Exit Criteria

Phase 0 is complete when:

- [x] The current-state baseline cites observable repository facts.
- [x] Protected surfaces and interim ownership are documented.
- [x] Risk classes include examples and minimum evidence expectations.
- [x] Known exceptions and technical debt are recorded without being presented as remediated.
- [x] Public/private evidence boundaries are documented.
- [x] The foundational ADR is recorded.
- [x] The AADB maintainer confirms or amends the proposed ownership map.
- [x] The AADB maintainer confirms or amends the proposed risk classes.
- [x] The AADB maintainer confirms or amends the evidence boundaries.
- [x] Open Phase 0 decisions have a named owner and target phase.

Completion of documentation is not the same as enforcement. Enforcement starts
only in a separately approved later phase.

## Open Decision Register

| Decision | Decision owner | Approval or consultation | Target |
| --- | --- | --- | --- |
| Confirm ownership and protected-surface map | Arturo Quiroga | Consult future named reviewers | Before Phase 1 |
| Confirm risk classes and minimum evidence | Arturo Quiroga | Consult security/evaluation reviewers where available | Before Phase 1 |
| Confirm solo-maintainer R3/R4 interim model | Arturo Quiroga | Independent security/privacy authority where applicable | Before Phase 1 |
| Confirm clean/isolated worktree release guidance | Arturo Quiroga | Azure release operator | Before Phase 1 |
| Confirm public/private evidence boundaries | Arturo Quiroga | Privacy/security authorities where applicable | Before Phase 1 |
| Resolve Impact feature Privacy/CELA gate | Arturo Quiroga owns escalation; authorized Privacy/CELA reviewer owns disposition | Privacy/CELA authority | Before Impact deployment, not before Phase 0 close |
| Name security reviewer or review group | Arturo Quiroga | Candidate reviewer(s) | Phase 2 entry |
| Name private quality repository and artifact store | Arturo Quiroga | Privacy/security authorities | Before Phase 5 |

The pending Impact gate does not block closing this documentation phase. It
continues to block deployment or release claims for the Impact feature until an
authorized disposition exists.

## Maintainer Decision Record

On 2026-08-14, Arturo Quiroga accepted as written:

1. The interim ownership and protected-surface map.
2. The R0-R4 risk model and solo-maintainer review/hotfix approach.
3. The clean/isolated worktree interim release guidance.
4. The public/private evidence placement and claim-discipline rules.

This decision closes Phase 0. Open items assigned to later phases remain open
and do not become technically enforced through this decision.
