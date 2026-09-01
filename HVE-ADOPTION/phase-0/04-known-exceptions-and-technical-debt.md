# Known Exceptions and Technical Debt Baseline

Baseline date: **2026-08-14**

This register records known gaps. Inclusion does not mean remediation has been
approved or completed.

## Governance Debt

| ID | Observation | Risk | Proposed disposition | Target phase |
| --- | --- | --- | --- | --- |
| GOV-001 | No protected-branch/PR policy is documented in the repository. | Direct changes can bypass review evidence. | Define and enable PR governance. | Phase 2 |
| GOV-002 | No PR template or issue forms are present. | Requirements and evidence are inconsistent. | Add risk, acceptance, validation, and privacy fields. | Phase 2 |
| GOV-003 | No CODEOWNERS file is present. | Sensitive changes may not reach the right reviewer. | Confirm ownership and add path rules. | Phase 2 |
| GOV-004 | No ADR process is established. | Architectural decisions can be lost in conversations. | Establish ADR conventions after this foundation ADR. | Phase 1, before Phase 2 approval |
| GOV-005 | No changelog or formal release policy is present. | Release scope and user-visible changes are difficult to reconstruct. | Define release/version policy. | Later phase |

## Quality and CI Debt

| ID | Observation | Risk | Proposed disposition | Target phase |
| --- | --- | --- | --- | --- |
| QLT-001 | CI builds web and MCP but does not run lint or focused tests. | Build success may be overinterpreted as quality acceptance. | Inventory, classify, and phase in passing gates. | Phase 2 |
| QLT-002 | No authoritative gate matrix maps change types to checks. | Validation is selected manually and inconsistently. | Publish gate matrix from risk classes. | Phase 1 or 2 |
| QLT-003 | Docker build is not a universal PR gate. | Packaging defects can escape TypeScript/Vite builds. | Add scoped or release Docker validation. | Phase 2 |
| QLT-004 | Secret scanning, dependency review, CodeQL, and action pinning are not visible as repository workflows. | Supply-chain and security defects have less automated coverage. | Baseline tools before making them required. | Phase 2 |
| QLT-005 | Document/presentation validation is manual. | Binary deliverables can contain layout or package defects. | Add path-scoped artifact checks where feasible. | Later phase |

## Lifecycle and Workspace Debt

| ID | Observation | Risk | Proposed disposition | Target phase |
| --- | --- | --- | --- | --- |
| LIF-001 | Durable RPI artifacts are not required for material work. | Decisions and evidence can remain only in chat history. | Pilot repository-owned RPI artifacts. | Phase 3 |
| LIF-002 | Multiple workstreams can coexist in one dirty worktree. | Unrelated or externally gated code can enter a release. | Confirm manual interim isolation guidance, then make it enforceable through later PR/release controls. | Phase 0 confirmation; enforcement in Phase 2 |
| LIF-003 | Local deployment paths can mutate production independently of PR review. | Reviewed source and deployed source can diverge. | Require immutable commit/image linkage and release evidence. | Phase 2/later |
| LIF-004 | No Definition of Ready or Definition of Done is authoritative. | Work can begin or close with implicit expectations. | Define lightweight criteria by risk class. | Phase 1 |

## AI and Evaluation Debt

| ID | Observation | Risk | Proposed disposition | Target phase |
| --- | --- | --- | --- | --- |
| AI-001 | Model/prompt changes do not have an enforced evaluation gate. | Product recommendations can regress without measured comparison. | Define AI change policy and pinned regression gate. | Later phase |
| AI-002 | Topology V2 human review is incomplete. | Model scorecard recommendations remain provisional. | Complete blinded review before registration/routing claims. | Existing evaluation workstream |
| AI-003 | App contracts and generated evaluation artifacts share the public repository. | Source, evidence, private review, and large artifacts can blur ownership. | Keep fast app contracts here; move private orchestration/artifacts to quality repo at V2/V3 boundary. | Phase 5 |
| AI-004 | Different product features lack separate evaluator suites. | A topology result can be misrepresented as evaluation of all AADB. | Build feature-specific suites. | Quality-engineering roadmap |

## Data, Privacy, and Artifact Debt

| ID | Observation | Risk | Proposed disposition | Target phase |
| --- | --- | --- | --- | --- |
| DAT-001 | Pending Impact measurement work has unresolved Privacy/CELA gates. | Collection could ship without approved purpose/retention/consent. | Keep undeployed until authorized decision. | External gate |
| DAT-002 | Twenty `.foundry` files and 56 `LATEST-ARTIFACTS` files are tracked. | Repository growth and evidence/source mixing. | Define retention and artifact storage policy. | Later phase |
| DAT-003 | Public-safe redaction rules are convention-based. | Internal resource identifiers, customer context, or reviewer identity can leak. | Add evidence-boundary review to templates and instructions. | Phase 1/2 |

## Proposed Interim Worktree Guidance

Until Phase 2 enforcement exists:

1. Material release artifacts should be built from a clean worktree at the
   intended commit or from a dedicated isolated worktree.
2. If development occurs in a mixed dirty worktree, the release source must be
   reconstructed through an explicit allowlist and validated independently.
3. The release record should identify the source commit, dirty-worktree state,
   included paths, excluded workstreams, artifact digest, and rollback target.
4. An externally gated workstream must not be included merely because it shares
   a file with approved work; use hunk-level isolation or a clean release tree.

This guidance was accepted through the Phase 0 maintainer decision on
2026-08-14. Automated enforcement is deferred.

## Baseline Exception Policy

Until later phases add enforcement:

1. Existing debt is not a reason to suppress unrelated safe changes.
2. New changes must not materially worsen a listed debt item without an explicit decision.
3. A release claim must identify checks not performed when they are relevant.
4. R4 changes remain blocked by their external gate even if builds pass.
5. Phase 0 may close while DAT-001 remains open because the debt item blocks the
   Impact feature release, not SDLC baseline documentation.
