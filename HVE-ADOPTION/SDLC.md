# AADB Software Development Lifecycle

Status: **Authoritative**

Owner: Arturo Quiroga

This is the single operational lifecycle for AADB. The accepted risk classes in
[Phase 0](phase-0/03-change-risk-classes.md) remain authoritative. HVE RPI is the
engineering workflow. Spec Kit is optional and is used only to define substantial
product features before RPI engineering begins.

## Lifecycle

```text
Intake and classify
  -> Define acceptance and non-goals
  -> Research readiness (read-only; research only when evidence is missing)
  -> Plan and independent critique
  -> Human plan approval
  -> Implement one bounded task
  -> Run the planned focused check
  -> Repeat implement/check
  -> Read-only acceptance review
  -> Pull request and required gates
  -> Human acceptance testing when applicable
  -> Explicit merge approval
  -> Explicit, separate production deployment approval
  -> Verify the exact changed behavior in production or roll back
```

Completion of implementation is not acceptance. Merge approval is not deployment
approval. A passing build is not product validation.

## Review Readiness Gate

Before human review begins, provide a one-screen brief in this order:

1. Blockers and critical findings
2. Unexpected discoveries
3. Plan deviations
4. Limitations and untested paths
5. Decision requested from the maintainer

The PR remains draft and `not-ready` until the maintainer has seen the brief.
Only then may `Review readiness` become `ready` and `Readiness acknowledgment`
become `acknowledged`. GitHub permits the draft-to-ready click before Actions
runs; the lifecycle check therefore fails afterward and, once required by the
main ruleset, blocks merge until readiness is complete. The check validates
presence and ordering, not the truth or sufficiency of narrative evidence.

## Choose the Smallest Sufficient Lifecycle

| Risk | Required lifecycle | Minimum gates |
| --- | --- | --- |
| R0 administrative | Direct | Relevant formatting/link check; self-review allowed |
| R1 low product risk | Direct or Plan | Acceptance criteria; focused check; visual/browser check for UI; public-safe review |
| R2 moderate product/contract risk | Plan -> Implement -> Review | Durable plan and rollback; focused regression tests; applicable build; representative fixtures; independent review or documented solo-maintainer exception |
| R3 high risk | Full RPI | Research-readiness decision; approved plan and critique; positive and negative tests; exact artifact/provenance; independent human acceptance review; explicit rollback |
| R4 externally gated | Full RPI, blocked until approval | All R3 gates plus recorded external approval, rehearsal/preflight, named rollback operator, exact post-deployment behavior check |

Examples and protected surfaces are in
[Change-Risk Classes](phase-0/03-change-risk-classes.md) and
[Ownership and Protected Surfaces](phase-0/02-ownership-and-protected-surfaces.md).
The highest applicable risk class wins.

Use Spec Kit before RPI when a feature has multiple user journeys, unresolved
product behavior, cross-component acceptance criteria, or a substantial brownfield
change. Spec Kit owns the product `what` and `why`; RPI owns engineering evidence,
implementation, review, and release. Small fixes do not require Spec Kit.

## Definition of Ready

R0/R1 work is ready when its intended outcome and focused check are explicit.
R2-R4 work is ready only when:

- Risk class, protected surfaces, acceptance criteria, and non-goals are recorded.
- Existing behavior and the controlling code path are evidenced, not assumed.
- Blast radius identifies consumers of changed contracts or invariants.
- The planned checks can falsify the implementation claim.
- Rollback is defined.
- R2+ has a durable plan; R3/R4 has an independent plan critique with `Pass`.
- Required privacy, security, architecture, evaluation, or external authorities are
  identified; an unresolved R4 gate blocks merge and deployment.

## Definition of Done

A change is done only when:

- Acceptance criteria are reconciled against implemented behavior.
- Every material implementation task has focused validation evidence.
- A bug has a regression fence shown failing on old behavior and passing on new
  behavior, or the PR records why no executable fence is possible.
- Applicable automated gates pass without retrying away unexplained failures.
- UI and artifact changes are checked at the user-visible output boundary.
- Claims identify what was Tested, Measured, Documented, or Inferred and do not
  exceed the tested subject, scope, or population.
- A read-only acceptance review records defects, limitations, and residual risk.
- User-facing documentation is current.
- Merge and production deployment each have separate explicit approval.
- A production release identifies commit, immutable artifact, rollback target, and
  a check of the exact changed behavior.

## Mandatory Stop Conditions

Stop implementation and return to Research or Plan when:

- A test fails unexpectedly or a previously passing gate becomes flaky.
- The current hypothesis is falsified or verification exercises a different path.
- A caveat affects acceptance criteria or release safety.
- Work crosses the approved paths, task, risk class, or protected surface.
- The plan needs a material departure.
- Evidence cannot support the intended claim.
- An external or human approval is missing.

Do not keep patching, retry until green, narrow the claim after shipping, or deploy
and disclose a caveat afterward. Record the evidence, amend the plan, obtain a new
critique when material, and resume only after approval.

## Test Discipline

- Before the first edit, identify one falsifiable local hypothesis and the cheapest
  check that could disprove it.
- After each bounded implementation task, run its focused check before expanding
  scope.
- For bugs, demonstrate the regression test against old and new behavior.
- Test outputs users receive, not only the engine producing them.
- A flaky required test is a defect: diagnose it, fix it, or quarantine it with a
  tracked owner and explicit non-blocking status. Blind retries are prohibited.
- `npm run verify:release` is the standard product gate, not a substitute for
  change-specific tests or human acceptance.

## Evidence Language

- **Tested:** directly observed by the cited check.
- **Measured:** quantified over the stated population and window.
- **Documented:** stated by an authoritative source, not independently tested here.
- **Inferred:** reasoned from evidence and labeled as inference.
- **Proposed:** not implemented or approved.

Record exact commands and scoped outcomes. A check for one model, path, browser,
region, export type, or revision is not evidence for all of them.

## Approval and Release Authority

- R0/R1 may use maintainer self-review.
- R2 seeks independent review. If unavailable, record the solo-maintainer exception,
  exact validation, reason, and residual risk.
- R3 requires independent human review. Urgent reliability/security exceptions
  follow the Phase 0 time-bounded hotfix rule.
- R4 cannot be self-exempted.
- AI review supplements evidence; it is not independent human approval.
- Only Arturo Quiroga, as interim release operator, can authorize production
  deployment until that role is delegated.
- An instruction to merge does not authorize deployment. The production approval
  must name the intended version and occur after release evidence is available.

## Public Evidence Boundary

All committed evidence must be safe for a public repository. Follow
[Evidence and Repository Boundaries](phase-0/05-evidence-and-repository-boundaries.md).
Secrets, customer/partner material, raw telemetry, reviewer identities, and private
security/privacy records do not belong here.
