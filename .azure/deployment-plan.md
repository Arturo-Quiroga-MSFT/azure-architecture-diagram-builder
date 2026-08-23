# Azure Deployment Plan

> **Status:** Validated — Production Foundation 1.2 Increment 1 (v1.1.0 remains deployed)

Generated: 2026-08-21

## 1. Goal

Add a self-contained greenfield deployment mode so another PSA can clone the repository and provision both AADB applications plus their required Azure AI model capability in a new subscription. The default path must not depend on Arturo's subscription, endpoint, API key, or pre-existing model deployments.

## 2. Proposed Ownership Boundary

The destination subscription will own:

- Resource group and all naming derived from the `azd` environment
- Microsoft Foundry `AIServices` account
- One default GPT model deployment suitable for AADB
- Managed-identity data-plane access from the web Container App to the Foundry resource
- Azure Container Registry
- Container Apps environment
- Public web Container App
- Internal MCP Container App by default
- User-assigned managed identity
- Azure Speech and Speech data-plane role
- Log Analytics and Application Insights
- Optional Cosmos DB when explicitly enabled

A Foundry project is not proposed because AADB uses model inference directly and does not use Foundry agents, project connections, evaluations, or project-scoped capability hosts.

## 3. Deployment Modes

- **Greenfield (default):** Provision the Foundry resource and default model; use managed identity with no OpenAI API key.
- **Bring your own AI (advanced):** Preserve the existing external endpoint/key or external endpoint/managed-identity option for subscriptions that already have approved model infrastructure.

## 4. Planned Artifacts

- Bicep resources and parameters for the Foundry account, model deployment, and resource-scoped OpenAI User role
- `azd` outputs that automatically feed the generated endpoint and deployment name into the web build/runtime
- Greenfield-first PSA deployment guide with model/quota preflight, exact resources, verification, security boundary, and cleanup
- BYO migration/override section
- Model configuration guide aligned with provisioned and optional models
- Validation checks for Bicep, generated ARM, packaging, role scope, secretless runtime, and a fresh-subscription preview

## 5. Approved Defaults

- Default model: `gpt-5.6-luna`
- Model version: `2026-07-09`
- SKU: `GlobalStandard`
- Capacity: 10 (10K TPM)
- Reasoning effort: medium (existing AADB default)
- Authentication: managed identity with resource-scoped `Cognitive Services OpenAI User`; local authentication disabled on the provisioned Foundry account
- Availability behavior: validation must fail before provisioning when the destination region lacks the model/SKU or the subscription has less available quota than the requested capacity; no silent fallback model
- Scope: provision one default model. Additional supported models remain opt-in through the model-configuration procedure
- Web authentication: public test endpoint remains explicitly test-only; Entra authentication is required before team or production use

Live discovery on 2026-08-21 confirmed GPT-5.6 Luna is GA in East US 2, supports the Responses API, and has version `2026-07-09`. `SUB-2` reported 1,000 unused `GlobalStandard` capacity units.

## 6. Validation Plan

- [x] All validation checks pass
  - [x] 1. AZD Installation
  - [x] 2. Schema Validation
  - [x] 3. Environment Setup
  - [x] 4. Authentication Check
  - [x] 5. Subscription/Location Check
  - [x] 6. Aspire Pre-Provisioning Checks (not applicable; this is not a .NET Aspire project)
  - [x] 7. Provision Preview, including Foundry catalog/quota preflight
  - [x] 8. Build Verification
  - [x] 9. Docker Build Context Validation
  - [x] 10. Package Validation
  - [x] 11. Azure Policy Validation
  - [x] 12. Aspire Post-Provisioning Checks (not applicable; this is not a .NET Aspire project)
- [x] Bicep compiles without errors or warnings from the new resources
- [x] Generated ARM contains one conditional `AIServices` account, one Luna deployment, and one account-scoped OpenAI User assignment
- [x] Greenfield outputs populate endpoint and `AZURE_OPENAI_DEPLOYMENT_GPT56LUNA` without an API key output
- [x] BYO mode retains its external endpoint/optional-key branch when `deployFoundry=false`
- [x] Model/quota preflight passes capacity 10 and rejects capacity 1001 in `SUB-2` East US 2
- [x] Production frontend build passes with Luna/medium defaults
- [x] No-change preview contains the Foundry account and Luna deployment in a clean environment with no BYO values

## 7. Validation Proof

Validated on 2026-08-21 against `SUB-2` without creating greenfield resources.

| Check | Result |
| --- | --- |
| Azure context | `SUB-2` (`f17e9bc0-a52e-4940-9b77-15ca4d4912b3`), tenant `42b0b4e2-f74e-4cca-a655-e50e383fa040`, East US 2 |
| Clean AZD environment | `aadb-greenfield-preview`; no `AZURE_OPENAI_ENDPOINT` or `AZURE_OPENAI_API_KEY` values |
| Foundry dependencies | `azd` and `microsoft.foundry` extension ready |
| Catalog | `gpt-5.6-luna` GA, Responses API, version `2026-07-09`, `GlobalStandard` and `DataZoneStandard` in East US 2 |
| Quota | `OpenAI.GlobalStandard.gpt-5.6-luna`: 0 used / 1,000 limit in `SUB-2`; capacity 10 passed; capacity 1001 rejected with the exact insufficient-quota error |
| Schema | `azure.yaml` valid against stable schema; Bicep API version `2025-06-01` grounded in Microsoft Learn |
| IaC | Bicep exit 0, zero code warnings; tracked ARM regenerated |
| ARM contract | Conditional `AIServices`, Luna model/version/SKU/capacity, OpenAI User role, generated endpoint/Luna outputs, no API-key output |
| Preview | Success in 21 seconds; proposed resource group, two Container Apps, environment, Foundry account, Luna deployment, Speech, ACR, App Insights, and Log Analytics |
| Frontend | Production build passed in 11.43 seconds; Luna/medium defaults asserted |
| Packaging | Web and MCP services packaged successfully in 1 minute 20 seconds |
| Policy | Existing Defender policy assignments reviewed; none deny the proposed resource types or East US 2 |
| BYO branch | `deployFoundry=false` skips Foundry catalog/quota preflight and retains external endpoint/optional-key inputs |

### Production Foundation 1.2 Increment 1 Proof

| Command / check | Exact result |
| --- | --- |
| `validate-deployment.sh --scope sub --location eastus2 --subscription 7a28b21e-0d3e-4435-a686-d92889d4ee96 --template ./infra/main.bicep --parameters /tmp/aadb-v120-validation-parameters.json` | `OVERALL: PASS`; CLI installed, authenticated, Bicep compiled, subscription deployment validated, and what-if reported Create 15 / Modify 0 / Delete 0 for isolated environment `aadb-v120-validate` |
| `npm run build` | Exit 0; Vite production build completed and `dist/version.json` reported `1.2.0` |
| `docker build -t aadb:v1.2.0-foundation-test ... .` | Exit 0; all 27 BuildKit steps completed |
| Local container `GET /`, `/api/health`, `/api/ready`, `/version.json` | HTTP 200; both runtime endpoints and static manifest reported `1.2.0` |
| Stop Node process inside the running container, then request `/api/health` | UI root remained HTTP 200 and `/api/health` returned HTTP 502, proving the probe detects loss of the co-located token server |
| `az bicep build --file infra/main.bicep` plus generated-template assertions | Exit 0; `/api/health`, `/api/ready`, and `/healthz` probe paths present |
| Live ready-revision template piped through `render-webapp-revision.mjs` | Three probes present; immutable image applied; runtime OpenAI key converted to `secretRef`; no secret-bearing env value emitted as plaintext |
| `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p tsconfig.node.json`, `npm run test:production-exclusions` | All exit 0 |
| `require-version-bump.sh` against production v1.1.0 | Passed transition `v1.1.0 -> v1.2.0` |

## 8. Role Assignment Verification

- **Identity:** One user-assigned managed identity is attached to both Container Apps.
- **ACR:** `AcrPull` is scoped to the generated registry.
- **Foundry:** `Cognitive Services OpenAI User` (`5e0bd9bd-7b93-4f28-af87-19fc36ad61bd`) is scoped to the generated `AIServices` account.
- **Speech:** `Cognitive Services Speech User` is scoped to the generated Speech account.
- **Cosmos DB:** Data Contributor remains conditional and is absent by default.
- **Secrets:** Greenfield mode forces the effective API key to empty, emits no key output, and configures `disableLocalAuth=true` on Foundry.
- **Issues:** None. Live role propagation and keyless Luna inference passed.

## 9. Deployment Proof

Deployed and verified on 2026-08-21 in `SUB-2`, East US 2, environment `aadb-greenfield-test`.

| Check | Result |
| --- | --- |
| Resource group | `rg-aadb-greenfield-test`; created from a previously absent target |
| Provisioning | Completed in 2 minutes 6 seconds |
| Foundry | `cog-aadb-jheuyqzrqofi4`, kind `AIServices`, public network enabled, local authentication disabled |
| Model | `gpt-5.6-luna`, version `2026-07-09`, `GlobalStandard`, capacity 10, provisioning state `Succeeded` |
| Generated endpoint | `https://cog-aadb-jheuyqzrqofi4.cognitiveservices.azure.com/` |
| Live RBAC | Exactly one ACR-scoped `AcrPull` and one Foundry-scoped `Cognitive Services OpenAI User` assignment |
| Web app | `https://ca-diagram-builder-jheuyqzrqofi4.greenforest-43436f56.eastus2.azurecontainerapps.io/`; revision healthy/provisioned with one replica |
| MCP app | Internal-only endpoint; revision healthy/provisioned with one replica |
| Keyless boundary | Web runtime contains `AZURE_OPENAI_ENDPOINT` only; no `AZURE_OPENAI_API_KEY` variable or secret reference |
| Luna inference | Deployed `/api/openai` returned HTTP 200; medium reasoning returned a valid structured architecture with App Service, Azure SQL Database, and Application Insights |
| Speech | Deployed `/api/speech-token` returned HTTP 200 with a valid East US 2 token through managed identity |
| Default resource boundary | Nine top-level resources; Cosmos DB count 0 |
| Cleanup | Not performed; `rg-aadb-greenfield-test` remains deployed for user verification |
| Frontend regression | Initial image had working runtime proxy but empty build-time endpoint/model values, so Generate and Guided Chat reported Azure OpenAI unconfigured |
| Root cause | `azd-prepackage.sh` accepted missing nested `azd` values and `continueOnError=true` allowed an AI-disabled image |
| Remediation | Hook now reads injected/selected-environment values, rejects malformed lines, requires endpoint plus at least one model, and fails packaging on error |
| Fixed revision | `ca-diagram-builder-jheuyqzrqofi4--azd-1787341221`; healthy, one replica, 100% latest-revision traffic |
| Browser verification | No configuration warning; selector contains only GPT-5.6 Luna; reasoning defaults to medium; prompt enables Generate; UI-originated generation completed in 10.6 seconds and created six React Flow nodes |

## 10. Production Foundation 1.2 Milestone

### Goal

Improve the existing VNet-hosted AADB application before adding major features: make releases observable, reversible, testable, faster to load, and safer to expose as a public learning experience. Preserve the core workflow: requirement → editable architecture → evidence-based review → deployable artifacts.

### Verified Baseline

- Production VNet app: `azure-diagram-builder-vnet` in `azure-diagrams-rg`, East US 2.
- Current release: `v1.1.0`; `/version.json`, UI, telemetry, and ACA `APP_VERSION` share the package version.
- Live `/api/health` returns 404; ACA health currently does not prove that the co-located token server is ready.
- The VNet deployment uses mutable image tag `:vnet`, ACR admin credentials, immediate latest-revision traffic, and separate image/environment updates that can create two revisions.
- Production main JavaScript bundle is approximately 3.71 MB uncompressed / 1.07 MB gzip.
- `src/App.tsx` is 4,493 lines and owns many unrelated feature lifecycles.
- The repository has 25 test/evaluation scripts, but no single required release command or browser smoke gate.
- The public learning app exposes server-side AI routes without a documented application-level request budget or abuse-control policy.
- The reusable greenfield Bicep and the current VNet production topology are separate deployment implementations.

### Scope and Sequence

#### Phase A — Runtime and Release Safety

1. Add shallow `/api/health` and `/api/ready` endpoints that verify nginx/token-server process readiness without calling external Azure dependencies.
2. Configure liveness, readiness, and startup probes for both the VNet deployment path and reusable Bicep path.
3. Build immutable image tags from app version plus Git SHA; retain the human-readable release version in `/version.json` and ACA `APP_VERSION`.
4. Update ACA once per release, wait for the candidate revision to become healthy, then move traffic; retain and report the prior revision for rollback.
5. Replace ACR admin-credential image pulls with managed identity and `AcrPull` where supported by the existing app boundary.

#### Phase B — Release Confidence and Performance Baseline

1. Add one `npm run verify:release` command covering TypeScript, focused lint, deterministic tests, production build, version contract, production exclusions, and Playwright smoke tests.
2. Add browser smoke coverage for page load, version display, model configuration, basic diagram rendering from a deterministic fixture, and critical modal opening.
3. Capture bundle composition and Web Vitals before optimization; establish budgets rather than optimizing by intuition.
4. Lazy-load export libraries and infrequently used heavy modals, then compare bundle and interaction metrics with the baseline.

#### Phase C — Maintainability and Public-Service Controls

1. Extract one lifecycle at a time from `App.tsx`, beginning with generation/session orchestration; no broad rewrite.
2. Add a root error boundary and feature-level recovery for generation, validation, and export surfaces.
3. Add request correlation IDs and structured token-server logs; connect frontend errors and backend requests in Application Insights/Log Analytics.
4. Define the public-demo policy: allowed models, request/token limits, concurrency, per-client throttling, and whether an authenticated partner mode is required. Do not add an Azure gateway product until this policy and cost boundary are approved.
5. Plan convergence of the VNet production topology and reusable Bicep path after runtime behavior is covered by release tests.

### Non-Goals

- No new AI models or major user-facing capabilities in this milestone.
- No full rewrite of `App.tsx` or state management.
- No migration away from Azure Container Apps.
- No new paid gateway or security service without an explicit architecture/cost decision.
- No external dependency checks in liveness probes; dependency outages must not trigger container restart loops.

### Validation Gates

- Local production build and `verify:release` pass.
- `/api/health` and `/api/ready` return documented, non-secret JSON.
- ACA startup/readiness/liveness probes are visible on the deployed revision.
- Candidate revision is healthy before receiving production traffic; rollback target is recorded.
- Deployed image reference is immutable and traceable to app version and Git SHA.
- Browser smoke confirms the primary workflow loads and the UI/runtime versions match.
- Bundle and Web Vitals measurements are recorded before and after performance changes; claims remain limited to measured scenarios.
- Public endpoint controls are documented and tested for the chosen public-demo policy.

### Delivery Plan

- **Increment 1:** Phase A health endpoints, probes, immutable image identity, and staged rollout/rollback.
- **Increment 2:** Phase B unified release verification and browser smoke suite.
- **Increment 3:** Phase B measured code splitting and performance budget.
- **Increment 4:** Phase C error boundaries, first `App.tsx` extraction, and correlated logging.
- **Decision gate:** choose public-demo access controls and VNet/Bicep convergence scope using measured traffic, cost, and operational evidence.

### Approval Boundary

The first implementation increment modifies application runtime code, Docker/nginx behavior, the VNet deployment script, and reusable Bicep probe configuration. It does not deploy or create Azure resources until validation is complete and deployment is separately approved through the existing Azure validation/deployment workflow.

### Increment 1 Implementation Evidence

Implemented locally on 2026-08-23; no Azure resources changed.

| Check | Result |
| --- | --- |
| Product version | Advanced from `1.1.0` to `1.2.0`; production build emits `{"version":"1.2.0"}` |
| Health contract | `/api/health` returns 200 when the Node token server is running; `/api/ready` returns 200 only when the core OpenAI endpoint is configured |
| Failure detection | Local production container kept serving `/` with HTTP 200 after Node termination while `/api/health` returned HTTP 502 through nginx |
| Runtime version | Container health, readiness, and `/version.json` all reported `1.2.0` without requiring an ACA runtime variable |
| Reusable IaC | Bicep compiled successfully; generated ARM contains startup/readiness/liveness probes for web (`/api/ready`, `/api/health`) and MCP (`/healthz`) |
| VNet rollout | Candidate template generated from the live ready revision, added all three probes, used an immutable `version+SHA` image, and replaced the plaintext OpenAI key environment value with a secret reference |
| Deployment guard | Live version check accepted `1.1.0 → 1.2.0`; dirty-worktree ACR builds were rejected |
| Static checks | Shell syntax, Node syntax, both TypeScript projects, `git diff --check`, and `test:production-exclusions` passed |
| Container build | Production Dockerfile built successfully; root, health, readiness, and version endpoints returned HTTP 200 through nginx |

### Increment 1 Role Assignment Verification

- **Reusable Bicep identity:** one user-assigned managed identity is attached to both app containers.
- **ACR:** built-in `AcrPull` is scoped to the generated registry.
- **Foundry:** built-in `Cognitive Services OpenAI User` is scoped to the generated Foundry account.
- **Speech:** built-in `Cognitive Services Speech User` is scoped to the generated Speech account.
- **Cosmos DB:** built-in Data Contributor is conditional and scoped to the generated Cosmos account.
- **Existing VNet app:** its system identity currently has no ACR role. The rollout script creates resource-scoped `AcrPull` before replacing stored registry credentials with managed-identity pull.
- **Runtime secret migration:** the candidate revision replaces the existing plaintext `AZURE_OPENAI_API_KEY` environment value with a Container Apps secret reference; keyless Foundry access remains a later security-boundary decision for this legacy deployment.
- **Issues:** no overbroad role assignments introduced by Increment 1.

Pending validation before deployment:

- [x] All Increment 1 validation checks pass
  - [x] 1. Core Validation (Azure CLI, authentication, Bicep build, deployment validation, and what-if)
  - [x] 2. Docker Build and local container health/failure-path smoke test
  - [x] 3. Azure Policy Validation
- [x] Confirmed subscription `7a28b21e-0d3e-4435-a686-d92889d4ee96`, tenant `a172a259-b1c7-4944-b2e1-6d551f954711`; operator has Owner and User Access Administrator.
- [x] Candidate template generated from the live ready revision and passed structural, probe, image, and plaintext-secret assertions without changing Azure.
- [x] Management-group deny/audit/deploy assignments reviewed; target app reports no current noncompliant policy states, and isolated what-if completed with no deletes.
- [x] ACR ARM audience authentication is enabled; managed-identity image pull is supported.
- [x] Multiple-revision traffic and rollback commands match current Azure CLI 2.87.0 / Container Apps extension 1.3.0 and official Container Apps guidance.
