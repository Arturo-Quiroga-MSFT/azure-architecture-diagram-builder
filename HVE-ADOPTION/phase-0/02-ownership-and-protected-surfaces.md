# Ownership and Protected Surfaces

Status: **Accepted as interim governance on 2026-08-14**

## Ownership Model

The repository currently has no `CODEOWNERS` file. The following model records
interim accountability for planning purposes; it does not grant organizational
approval authority.

| Role | Interim assignment | Proposed interim accountability |
| --- | --- | --- |
| AADB accountable maintainer | Arturo Quiroga | Product direction, repository stewardship, release acceptance, and owner assignment |
| Code author | Change author | Requirements traceability, implementation, tests, and truthful validation evidence |
| Independent reviewer | TBD per change | Read-only reconciliation of acceptance criteria, implementation, and evidence |
| Security reviewer | TBD | Security-sensitive design and negative-test review |
| Privacy/CELA authority | External authorized reviewer, TBD | Privacy/CELA disposition where required; repository maintainers cannot self-approve this authority |
| Azure release operator | Arturo Quiroga until delegated | Artifact selection, production update, verification, and rollback readiness |
| Human AI evaluator | Named Azure architect or approved review team | Blinded quality ratings and evaluator calibration |

One person may perform multiple operational roles for a low-risk change, but a
change must not claim independent review when the author and reviewer are the
same person or AI session.

## Solo-Maintainer Interim Model

This model is **accepted as manual interim governance and is not yet
technically enforced**:

1. R0 and R1 work may use maintainer self-review when acceptance and validation
   evidence are explicit.
2. R2 work should seek independent review. If unavailable, the maintainer may
   proceed only by recording that review was not independent, the reason, the
   exact validation performed, and residual risk.
3. R3 releases require an independent human reviewer. An urgent security or
   reliability hotfix may use a time-bounded exception when delay creates
   greater risk: record the reason, exact artifact, negative tests, rollback,
   and obtain post-release independent review within two business days.
4. R4 external gates cannot be self-exempted. Development may continue in
   isolation, but merge/deployment of the gated behavior remains blocked.
5. AI review can supplement evidence but does not satisfy the independent human
   reviewer requirement.

## Protected Surfaces

A protected surface is a path or behavior where changes require explicit risk
classification and surface-specific evidence. Protection is documented here;
technical enforcement is deferred to later phases.

| Surface | Representative paths | Why protected | Required authority or consultation |
| --- | --- | --- | --- |
| Authentication and authorization | `server/`, Entra integration, MCP bearer auth | Controls access to APIs, Azure resources, and tools | Security reviewer; privacy review when identity data changes |
| Privacy and telemetry | telemetry services, feedback/impact endpoints, analytics schemas | May collect, retain, or expose user or organizational data | Privacy/CELA authority and security reviewer |
| AI generation contract | prompts, model settings, normalization/post-processing | Changes user-visible architecture behavior and evaluation comparability | AADB maintainer and evaluation owner |
| WAF validation and recommendations | WAF rules, architecture validators, recommendation application | Can be interpreted as professional architecture guidance | AADB maintainer and qualified architecture reviewer |
| Pricing and cost claims | pricing data, parsers, defaults, estimators, exports | Incorrect estimates can mislead architects and partners | AADB maintainer; pricing contract/audit evidence |
| MCP public contract | `mcp-server/` schemas, tools, authentication | External agents depend on typed behavior and access controls | AADB maintainer and security reviewer |
| Deployment and infrastructure | `azure.yaml`, `infra/`, Dockerfiles, deployment scripts/workflows | Can change production resources, identity, networking, secrets, or cost | Azure release operator; security review for boundary changes |
| Evaluation lineage | `evaluations/`, `eval.yaml`, `.foundry/`, shared contracts | Supports model claims and future routing decisions | Evaluation owner and named human reviewer for approval gates |
| Public documentation and claims | `README.md`, `DOCS/`, blogs, generated presentations | Public statements can exceed tested evidence | AADB maintainer and subject owner |
| Dependency and workflow supply chain | lockfiles, GitHub Actions, package configuration | Affects build integrity and external code execution | AADB maintainer; security review for material changes |

## Ownership Decisions Still Required

| Decision | Owner | Target phase |
| --- | --- | --- |
| Confirm solo-maintainer interim model | AADB maintainer | Before Phase 1 |
| Confirm named security reviewer or review group | AADB maintainer | Phase 2 |
| Confirm privacy/CELA escalation path in public-safe terms | AADB maintainer owns escalation; authorized authority owns disposition | Before privacy-sensitive release |
| Confirm human evaluation review team | AADB maintainer | Before V2 evaluation approval |
| Confirm CODEOWNERS path mappings | AADB maintainer | Phase 2 |
| Define backup release operator | AADB maintainer | Before release automation becomes required |
