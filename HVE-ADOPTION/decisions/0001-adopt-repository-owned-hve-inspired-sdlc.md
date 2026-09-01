# ADR-0001: Adopt a Repository-Owned HVE-Inspired SDLC

- Status: Accepted
- Date: 2026-08-14
- Decision owner: Arturo Quiroga
- Scope: AADB engineering lifecycle

## Context

AADB has production builds, Azure deployment automation, deterministic tests,
pricing audits, security guidance, privacy review work, and AI evaluation
assets. These controls are valuable but are not yet organized into one
authoritative lifecycle with risk-based evidence, durable decisions, independent
review, and controlled release expectations.

Microsoft HVE Core provides useful AI-assisted lifecycle patterns, especially
Research, Plan, Implement, Review, and Follow-up. HVE Core also describes itself
as opinionated and rapidly evolving, and recommends adapting relevant patterns
to team needs.

## Decision

AADB will adopt an incremental, repository-owned SDLC inspired by HVE Core.

1. Conventional SDLC controls remain authoritative.
2. HVE RPI practices are used selectively for work that benefits from durable
   evidence, planning, implementation records, and independent review.
3. AADB will own and version its instructions, templates, risk model, quality
   gates, and lifecycle documentation.
4. HVE Core will not become an AADB runtime, build, or production dependency.
5. HVE components will be copied or adapted selectively only after review.
6. Adoption proceeds incrementally; later phases require explicit approval.
7. Sensitive evaluation, privacy, customer, partner, and telemetry evidence
   remains outside the public repository unless explicitly approved and sanitized.
8. Phase 0 documentation does not enforce later-phase controls. Proposed
   ownership, risk, worktree, and evidence rules become active only after
   maintainer confirmation or later technical enforcement as stated.
9. An unresolved external gate blocks the affected feature or release claim;
   it does not block unrelated SDLC documentation work.

## Consequences

### Positive

- AI-assisted changes become more reproducible and reviewable.
- Evidence and claims can be traced to acceptance criteria and exact checks.
- Riskier changes receive stronger controls without burdening trivial edits.
- AADB retains control when HVE Core interfaces or recommendations evolve.
- Public/private boundaries become explicit.

### Costs and Risks

- Durable artifacts create maintenance overhead.
- Poorly scoped adoption could become ceremony without improving outcomes.
- Instructions and agents can conflict or drift if ownership is unclear.
- Solo-maintainer work may not always have an immediately available independent human reviewer.
- Existing technical debt must be baselined before all gates can become mandatory.

## Alternatives Considered

### Adopt HVE Core wholesale

Rejected. It would create unnecessary coupling to a rapidly evolving framework
and import many artifacts unrelated to AADB.

### Install only the extension with no repository policy

Rejected as the target state. It can improve individual productivity but does
not create durable team governance or release evidence.

### Continue with ad hoc controls

Rejected. Recent work demonstrated strong manual discipline but also showed the
cost of reconstructing gates and release isolation for each material change.

### Build an entirely custom methodology without HVE references

Rejected. HVE provides relevant, reusable patterns, terminology, and lessons
that can accelerate a repository-owned solution.

## Validation

This ADR is validated when Phase 0 artifacts:

- Describe the observed current state without overstating enforcement.
- Mark unconfirmed ownership and future controls as proposed or TBD.
- Define risk classes and evidence boundaries.
- Do not modify product behavior or CI.

## Follow-Up

The next approved phase should confirm ownership and introduce a small number of
repository instructions and readiness/done definitions. No later-phase artifact
is authorized by this ADR alone.
