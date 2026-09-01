# Current-State SDLC Baseline

Baseline date: **2026-08-14**

## Repository and Product Shape

| Observation | Evidence |
| --- | --- |
| The canonical remote is public GitHub. | `origin` is `Arturo-Quiroga-MSFT/azure-architecture-diagram-builder`. |
| The primary application is React and TypeScript built with Vite. | Root `package.json`, `tsconfig.json`, and `vite.config.ts`. |
| A co-located/related MCP server has an independent Node build. | `mcp-server/package.json` and root `mcp:build`. |
| Azure Container Apps deployment is configured through `azd`. | `azure.yaml`, Dockerfiles, and deployment scripts. |
| The repository includes AI model integration and evaluation assets. | `src/services`, `eval.yaml`, `evaluations/`, and 20 tracked `.foundry` files. |
| The repository contains generated deliverables. | 56 tracked files under `LATEST-ARTIFACTS/`. |
| Local-only material is intentionally excluded. | `.gitignore` excludes `DONOTTRACK/`, environment files, private collaboration notes, and rollback snapshots. |

## Current Lifecycle as Practiced

The current lifecycle is capable but convention-driven rather than consistently
enforced:

1. Requirements originate in conversations, feedback, demonstrations, research,
   or local planning documents.
2. Implementation can occur directly in a long-lived working tree containing
   multiple concurrent workstreams.
3. Validation is selected manually according to the task. The repository has
   useful scripts, but no single authoritative gate matrix.
4. Changes may be committed and deployed through local scripts, `azd`, ACR, and
   Azure Container Apps workflows.
5. Production verification and rollback evidence can be strong, but the required
   evidence is not yet defined as repository policy.
6. Durable Research, Plan, Implement, and Review artifacts are not required.

This description does not imply that every historical change followed every
step or that controls were absent. It records that the steps are not yet a
single enforced lifecycle.

## Existing Controls

### Automated

- `.github/workflows/ci.yml` builds the Vite application and MCP server on pushes
  and pull requests to `main`.
- `.github/workflows/azure-dev.yml` provides a manual `azd` deployment workflow
  with Azure OIDC authentication.
- Root and MCP lockfiles support deterministic npm installation.
- TypeScript compilation is part of both production builds.

### Executable but Not Universal PR Gates

- ESLint
- ARM extraction tests
- Layout-preservation tests
- Validation-freshness tests
- Service-name normalization tests
- Pricing-mode contracts
- Pricing structural and semantic audits
- AADB deterministic and model evaluation workflows
- Docker builds and local container smoke tests

### Governance and Safety Assets

- Microsoft security reporting policy
- Contributor guidance and CLA workflow
- Code of Conduct
- Privacy/CELA review material for the pending Impact feature
- Versioned AI evaluation datasets, manifests, reviews, and scorecards
- Deployment scripts and rollback practices

## Measured Gaps

As of the baseline date:

| Control | Current state |
| --- | --- |
| GitHub workflows | 2 |
| Tracked test-related files | 17 by broad filename/path search; 10 in the narrower `scripts/test*` plus `tests/` inventory |
| PR template | None observed |
| Issue forms/templates | None observed |
| CODEOWNERS | None observed |
| ADR process | None observed |
| Changelog | None observed |
| Repository-level Copilot instructions | None observed |
| Formal Definition of Ready/Done | None observed |
| Required RPI evidence | None observed |
| Unified test/gate classification | None observed |

## Baseline Risks

- A successful build can be mistaken for complete product validation.
- Validation scope and release claims can diverge.
- Concurrent dirty-worktree changes can enter a release unless isolated manually.
- Sensitive changes can proceed without a durable approval record.
- AI prompt/model changes can ship without a pinned evaluation comparison.
- Generated and evaluation artifacts can increase repository size and blur source
  versus evidence ownership.
- Local deployment paths can bypass future PR governance unless explicitly constrained.

## Baseline Strengths to Preserve

- **Inferred from reviewed release history:** evidence discipline can be strong
   when a release is handled deliberately.
- **Observed:** focused deterministic contracts exist for critical behavior.
- **Observed:** model and architecture evaluation lineage is versioned.
- **Observed:** Azure managed identity and OIDC patterns are present.
- **Observed:** local container validation and rollback practices have supporting scripts and records.
- **Observed:** ignored directories separate several local/private workstreams.
- **Observed:** open-source contribution and security policies are present.

## Test Inventory Count Basis

The broad 17-file count includes:

- 1 test-prompt document
- 1 application test file
- 2 MCP test scripts
- 3 evaluation test scripts
- 7 root `scripts/test*` assets
- 3 ARM fixture files

The narrower 10-file count includes only the 7 root `scripts/test*` assets and
3 files under `tests/`. These are inventory counts, not a claim that all files
are executable tests or current CI gates.
