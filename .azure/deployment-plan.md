# Azure Deployment Plan

> **Status:** Deployed

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
