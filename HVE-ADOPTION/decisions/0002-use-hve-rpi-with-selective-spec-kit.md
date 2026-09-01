# ADR-0002: Use HVE RPI with Selective Spec Kit

- Status: Accepted
- Date: 2026-09-01
- Decision owner: Arturo Quiroga
- Scope: AADB product and engineering lifecycle

## Context

Recent regressions were not caused by a lack of effort or isolated coding errors.
Work crossed lifecycle boundaries: implementation began while diagnoses were still
moving, passing gates did not exercise user outputs, unexpected failures were
retried, and caveats were disclosed after release decisions. Phase 0 defined a
risk-based HVE-inspired lifecycle but remained ignored local documentation, so it
did not change repository behavior.

HVE Core provides Research, Plan, Implement, Review, and follow-up separation.
Spec Kit provides strong product specification, clarification, task decomposition,
and convergence for substantial features. Neither framework alone configures AADB
branch protection, CI gates, release authority, or deployment safety.

## Decision

1. AADB's primary engineering lifecycle is repository-owned and HVE-inspired.
2. HVE RPI phases remain distinct. A material divergence returns to Plan rather
   than being improvised inside Implement.
3. Spec Kit is used selectively for substantial product definition, before RPI.
4. Spec Kit does not become a second mandatory engineering lifecycle.
5. HVE Core and Spec Kit are pattern/tool sources, not runtime or production
   dependencies.
6. Conventional controls remain authoritative: pull requests, required CI, human
   approval, immutable artifacts, rollback, and production verification.
7. Phase 1 instructions guide agent behavior; Phase 2 checks and repository
   settings enforce what can be enforced mechanically.
8. Merge and production deployment require separate, explicit human decisions.

## When to Use Spec Kit

Use it when the change has multiple user journeys, material product ambiguity,
cross-component acceptance criteria, or significant brownfield evolution. The
resulting specification becomes input to the RPI plan.

Do not require it for isolated fixes, dependency updates, documentation, or work
whose behavior and acceptance criteria are already clear.

## Consequences

### Benefits

- Product intent and engineering evidence have clear owners.
- Unexpected findings cause an explicit lifecycle transition rather than ad hoc
  continuation.
- AADB gains discipline without coupling itself to rapidly changing frameworks.
- Small changes retain a lightweight path.

### Costs and limits

- Material changes require durable planning and review evidence.
- Repository instructions influence agents but cannot guarantee compliance.
- Independent human review and GitHub environment protection require named people
  and repository settings outside source control.
- Mechanical gates validate evidence presence and executable checks; they cannot
  prove that narrative evidence is truthful.

## Alternatives

- **Adopt HVE Core wholesale:** rejected because HVE itself warns that interfaces
  evolve and recommends adapting patterns into a system the team owns.
- **Use Spec Kit as the entire SDLC:** rejected because specification does not
  replace release governance, CI, independent review, or deployment controls.
- **Use both end-to-end on every task:** rejected as overlapping ceremony.
- **Continue convention-driven work:** rejected because the conventions did not
  prevent repeated regressions or premature releases.
