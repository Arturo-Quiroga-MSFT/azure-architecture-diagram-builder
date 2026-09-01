# Change-Risk Classes

Status: **Accepted as interim governance on 2026-08-14**

Risk is determined by the highest applicable class. File count alone does not
set risk; a one-line authentication or privacy change can be high risk.

These classes describe the accepted interim evidence model. They are not
technically enforced during Phase 0. The solo-maintainer path is documented in
[02-ownership-and-protected-surfaces.md](02-ownership-and-protected-surfaces.md#solo-maintainer-interim-model).

## R0 - Administrative

Examples:

- Typographical correction with no semantic change
- Non-executable comment correction
- Link correction to the same intended public resource

Minimum evidence:

- Confirm the intended text or link
- Relevant formatting or link check
- Review may be lightweight

RPI guidance: usually unnecessary.

## R1 - Low Product Risk

Examples:

- Isolated UI copy or styling change
- Public documentation update
- Presentation or generated artifact update
- Non-behavioral refactor with established tests

Minimum evidence:

- Explicit acceptance criteria
- Focused build or renderer check
- Visual/browser check when user interface output changes
- Public-safe content review

RPI guidance: direct Plan or Implement may be sufficient when evidence is clear.

## R2 - Moderate Product or Contract Risk

Examples:

- Cross-component feature
- Export behavior
- Service-name normalization
- Deterministic architecture post-processing
- Non-sensitive MCP schema extension
- Pricing parser/default changes that do not alter source provenance policy

Minimum evidence:

- Durable plan with affected surfaces and rollback approach
- Focused deterministic tests
- Web and/or MCP build
- Regression checks against representative fixtures
- Independent review

RPI guidance: Plan, Implement, and Review; Research only when evidence is incomplete.

## R3 - High Risk

Examples:

- Authentication or authorization
- Privacy, telemetry, retention, feedback, or impact measurement
- Public MCP authentication or externally consumed contract changes
- AI prompt, model default, routing, or normalization changes affecting recommendations
- WAF scoring/recommendation behavior
- Pricing provenance, commitment-pricing, or published cost semantics
- Production deployment logic or infrastructure boundary changes

Minimum evidence:

- Research or documented evidence-readiness decision
- Approved plan and independent critique
- Threat/privacy/evaluation review as applicable
- Positive and negative tests
- Exact artifact build and provenance
- Independent acceptance review
- Explicit rollback path

RPI guidance: full Research-readiness, Plan, Implement, Review, and Follow-up routing.

## R4 - Release-Critical or Externally Gated

Examples:

- Change requiring unresolved Privacy/CELA approval
- Destructive data or infrastructure migration
- Secret, identity, tenant, or subscription migration
- Production change without a tested rollback
- Model recommendation/routing change without required human-reviewed evaluation evidence
- Change with unresolved critical security findings

Minimum evidence:

- All R3 evidence
- Explicit approval from the external authority or accountable owner
- Deployment rehearsal or equivalent preflight
- Named rollback operator and rollback trigger
- Post-deployment verification against the exact changed behavior

RPI guidance: full lifecycle. The change is blocked until the external gate is satisfied.

The pending Impact measurement Privacy/CELA gate is an R4 gate on that feature.
It does not block documenting or completing Phase 0, and it does not authorize
the gated feature to merge or deploy.

## Classification Examples

| Change | Class | Rationale |
| --- | ---: | --- |
| Fix a typo in a public guide | R0 | No behavioral effect |
| Remove a misleading toolbar control | R1 | User-visible but isolated and reversible |
| Change architecture ID repair behavior | R2 | Shared deterministic contract |
| Refresh PAYG data without changing selection semantics | R2 | Large data change with bounded structural/semantic audits |
| Change pricing source/provenance selection | R3 | Can alter professional cost claims |
| Add optional adoption telemetry pending Privacy/CELA | R4 | External privacy gate unresolved |
| Change MCP bearer-auth enforcement | R3 | Public authorization boundary |
| Deploy a validated image-only revision | R3 | Production mutation with rollback requirement |
