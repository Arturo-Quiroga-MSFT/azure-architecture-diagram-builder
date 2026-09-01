
# AADB HVE-Inspired SDLC Adoption Proposal

> Status: Source proposal. Phase 0 implementation artifacts are indexed in
> [README.md](README.md). This file is retained as the original adoption
> recommendation and is not itself an enforced engineering policy.

Yes, AADB is a strong candidate for HVE adoption. But I would implement it as a **repository-owned engineering system inspired by HVE Core**, not make AADB operationally dependent on the HVE repository.

HVE Core itself cautions that it is opinionated and rapidly evolving. Treat it as a source of patterns, agents, instructions, and lifecycle discipline. Own the resulting process inside AADB.

## Current Posture

AADB already has useful engineering assets:

- TypeScript and MCP production builds
- 17 tracked test-related files
- Two GitHub workflows
- Azure deployment automation
- Pricing contracts and audits
- AI evaluation datasets and scorecards
- Security reporting policy
- Privacy/CELA work
- Local deployment validation and rollback practices

But these pieces do not yet form a consistent SDLC:

- CI runs only the web and MCP builds.
- Tests, lint, pricing audits, Docker builds, and security checks are not PR gates.
- No PR template or issue forms.
- No `CODEOWNERS`.
- No ADR process.
- No changelog or formal release policy.
- No documented Definition of Ready or Definition of Done.
- No repository-level Copilot instructions.
- No durable Research → Plan → Implement → Review records.
- Deployments can still happen outside a reviewed PR.
- App code, generated datasets, operational artifacts, and pending experiments can coexist in one dirty worktree.
- AI model changes do not yet require evaluation evidence before release.

The recent pricing release demonstrated both the strength and the weakness: we applied excellent validation discipline, but had to construct that discipline manually during the session.

## Recommended HVE Model

Use two connected layers:

### 1. Standard SDLC Controls

These remain authoritative regardless of whether AI is used:

```text
Issue / requirement
        ↓
Research and design
        ↓
Approved implementation plan
        ↓
Feature branch and implementation
        ↓
Automated quality gates
        ↓
Independent review and PR approval
        ↓
Controlled release
        ↓
Production verification and operations
```

### 2. HVE RPI Workflow

Use HVE to make AI-assisted work repeatable and auditable:

```text
Evidence
  → Research when needed
  → Plan with acceptance criteria
  → Independent plan critique
  → Implement bounded tasks
  → Record validation evidence
  → Independent review
  → Route follow-up work
```

Not every typo needs RPI. Use it for:

- Cross-module changes
- New product features
- Model or prompt changes
- Authentication and privacy changes
- Pricing logic
- Azure infrastructure or deployment changes
- Public API/MCP contracts
- Architecture decisions
- Changes with customer or partner implications

## AADB Engineering System V1

I recommend establishing this repository structure:

```text
.github/
├── CODEOWNERS
├── copilot-instructions.md
├── ISSUE_TEMPLATE/
│   ├── bug.yml
│   ├── feature.yml
│   ├── security-design.yml
│   └── evaluation-change.yml
├── pull_request_template.md
├── instructions/
│   └── aadb/
│       ├── typescript-react.instructions.md
│       ├── azure-deployment.instructions.md
│       ├── ai-evaluation.instructions.md
│       └── privacy-security.instructions.md
├── agents/
│   └── aadb/
│       ├── aadb-research.agent.md
│       ├── aadb-review.agent.md
│       └── aadb-release.agent.md
└── workflows/
    ├── ci.yml
    ├── security.yml
    └── release.yml

docs/
├── engineering/
│   ├── SDLC.md
│   ├── DEFINITION-OF-DONE.md
│   ├── TESTING-STRATEGY.md
│   ├── RELEASE-POLICY.md
│   └── AI-CHANGE-POLICY.md
├── adr/
│   ├── README.md
│   └── 0001-record-architecture-decisions.md
└── operations/
    ├── deployment-runbook.md
    ├── rollback-runbook.md
    └── incident-response.md

.copilot-tracking/
├── research/
├── plans/
├── details/
├── changes/
└── reviews/
```

Public tracking artifacts must contain only public-safe information. Customer data, reviewer identities, internal telemetry, privacy materials, and model weakness investigations belong in the proposed private quality-engineering repository.

## First CI Baseline

Before introducing many custom agents, strengthen ordinary PR gates:

1. Dependency installation from approved feeds where required.
2. Web TypeScript and Vite build.
3. MCP build.
4. ESLint with zero new violations.
5. Focused deterministic tests.
6. Service-name and layout contracts.
7. Pricing contracts and structural/semantic audits.
8. Docker build.
9. Secret scanning.
10. Dependency review.
11. CodeQL.
12. GitHub Actions dependency pinning.
13. DOCX/PPTX validation only when those artifacts change.

Do not activate every test globally on day one. First classify the current tests into:

- Fast PR tests
- Feature-specific PR tests
- Nightly evaluation tests
- Release gates
- Manual evidence checks

## AI-Specific Release Policy

AADB needs an explicit change classification:

| Change | Minimum evidence |
| --- | --- |
| UI-only presentation change | Build, lint, focused browser test |
| Deterministic pricing/service logic | Unit contract, semantic audit, build |
| Prompt or model configuration | Pinned evaluation suite, comparison against baseline |
| Normalization/post-processing | Deterministic dataset replay, regression analysis |
| WAF rules/evaluator | Known-finding precision/recall suite |
| MCP contract | Schema tests, build, authenticated runtime test |
| Authentication/privacy | Threat review, privacy review, negative tests |
| Azure deployment | Local container, preflight, image digest, health, rollback proof |

Model recommendation changes should require human-reviewed evaluation evidence. The current V2 seed is hypothesis-generating evidence, not yet sufficient for automatic routing.

## HVE Adoption Sequence

Follow HVE’s own incremental guidance.

### Phase 0: Baseline and Decisions

- Document the current lifecycle.
- Identify owners and protected surfaces.
- Define change-risk classes.
- Record known exceptions and technical debt.
- Decide what belongs in the public repository versus the private evaluation repository.

### Phase 1: Instructions

Start with two or three instructions:

- Repository-wide engineering and evidence discipline
- TypeScript/React conventions
- Azure deployment, privacy, and security constraints

This is the lowest-cost HVE adoption and immediately improves Copilot behavior.

### Phase 2: PR Governance

- Require feature branches and PRs.
- Protect `main`.
- Require CI checks.
- Add PR and issue templates.
- Add `CODEOWNERS`.
- Require acceptance criteria and validation evidence.
- Prohibit direct production deployment from an uncommitted or dirty tree.

### Phase 3: RPI Pilot

Use RPI on one medium-risk feature:

- Research only if evidence is missing.
- Produce a durable plan and critique.
- Implement by stable task identifiers.
- Record changes and exact validations.
- Conduct a read-only acceptance review.
- Measure process cost and defects caught.

Do not use the privacy/CELA-pending Impact feature as the first pilot. Its unresolved policy questions would confound whether HVE itself works.

### Phase 4: Agents and Prompts

After the written process stabilizes, add:

- AADB code-review agent
- AI evaluation-change prompt
- Azure release-readiness agent
- Pricing refresh/review prompt
- Documentation and artifact validation prompt

### Phase 5: Skills and Private Evaluation Lab

- Package stable AADB-specific workflows as skills.
- Move evaluation orchestration and generated artifacts to `aadb-quality-engineering`.
- Keep app contracts and fast regression gates in AADB.
- Pin every private evaluation run to an immutable AADB commit.

## Definition of Done

A material AADB change should not be “done” until:

- Requirement and acceptance criteria exist.
- Relevant architecture/privacy/security decisions are recorded.
- Tests cover the changed behavior.
- Builds and applicable audits pass.
- No secrets or internal feed URLs enter the public repository.
- User-facing documentation is updated.
- AI-generated claims are labeled measured, documented, or inferred.
- Independent review reconciles implementation with the plan.
- Deployment has a unique artifact digest and rollback path.
- Production verification checks the actual changed behavior.
- Residual risks and follow-up items have owners.

## What Not to Do

- Do not clone all 200+ HVE artifacts into AADB.
- Do not make HVE Core a runtime or build dependency.
- Do not equate agent output with review approval.
- Do not require a heavyweight research document for every small change.
- Do not store internal evaluation captures or privacy records publicly.
- Do not add CI gates that already fail without first establishing a measured baseline and remediation plan.
- Do not let durable AI artifacts become unreviewed paperwork.

## Recommended Starting Point

The first implementation should be a dedicated branch such as:

```text
engineering/hve-sdlc-foundation
```

Its scope should be limited to:

1. `docs/engineering/SDLC.md`
2. `docs/engineering/DEFINITION-OF-DONE.md`
3. `.github/pull_request_template.md`
4. `.github/ISSUE_TEMPLATE/`
5. `.github/CODEOWNERS`
6. `.github/copilot-instructions.md`
7. Two focused instruction files
8. CI inventory and proposed gate matrix
9. One ADR establishing the HVE-inspired lifecycle
10. No product behavior changes

Then run that foundation itself through an HVE RPI workflow. That creates the first durable example and lets you evaluate the process before imposing it on every contribution.

My recommendation is therefore: **adopt HVE now, incrementally, as an AI-assisted layer over a conventional protected-branch SDLC. Own the resulting AADB workflow rather than importing HVE Core wholesale.**
