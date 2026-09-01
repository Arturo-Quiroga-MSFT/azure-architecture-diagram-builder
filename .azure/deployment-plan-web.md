# Azure Deployment Plan

> **Status:** Deployed

Generated: 2026-08-18

## 1. Project Overview

**Goal:** Deploy the current Azure Architecture Diagram Builder web application to its existing VNet-integrated Azure Container App while excluding the unreviewed Adoption & Impact feature from the production client, telemetry enrichment path, and server API surface.

**Mode:** Modify an existing deployment; image-only update. No infrastructure provisioning or deletion.

## 2. Approved Deployment Boundary

| Attribute | Value |
| --- | --- |
| Application | `azure-diagram-builder-vnet` |
| Resource group | `azure-diagrams-rg` |
| Subscription | `7a28b21e-0d3e-4435-a686-d92889d4ee96` (confirmation required) |
| Location | East US 2 (confirmation required) |
| Container Apps environment | `aca-env-azure-diagrams-vnet` |
| Registry | `acrazurediagrams1767583743` |
| Image | `azure-diagram-builder:vnet` |
| Ingress target port | `80` |
| Deployment method | Existing `scripts/production/deploy-webapp.sh` |
| Rollback boundary | Existing healthy ACA revision remains available; legacy non-VNet app is untouched |

The standalone MCP Container App and the private `aadb-usage-analytics` Container App are out of scope and must not be changed.

## 3. Feature Exclusion

Production must satisfy all of the following:

- `VITE_ENABLE_ADOPTION_IMPACT=false` during the Vite build.
- `ENABLE_ADOPTION_IMPACT=false` in the server image and ACA runtime environment.
- No Adoption & Impact launcher or modal in the production client.
- No impact profile/attribution enrichment in production telemetry.
- `/api/impact-story` and `/api/deployment-registration` are not registered and return `404`.
- Disabled image omits `impact-routes.js` and `impact-records.js`.
- Local development retains the feature for CELA/LT review; explicit production enablement requires `VITE_ENABLE_ADOPTION_IMPACT=true` and `ENABLE_ADOPTION_IMPACT=true`.

## 4. Recipe Selection

**Selected:** Existing script-driven ACR build plus image-only Azure Container Apps update.

**Rationale:** The app and infrastructure already exist. Full provisioning or `azd up` would expand blast radius and is unnecessary. The existing script builds remotely in ACR, forces a unique ACA revision suffix, preserves the existing stable tag, and updates only the primary VNet-integrated app.

## 5. Preparation Checklist

- [x] Confirm target application from repository deployment memory and script.
- [x] Add compile-time client feature gate, default off for production.
- [x] Isolate impact telemetry from core telemetry.
- [x] Add runtime server route gate.
- [x] Force both deployment flags false in the VNet deployment script.
- [x] Add repeatable production exclusion contract.
- [x] Production TypeScript/Vite build succeeds.
- [x] Disabled client artifact contains none of the prohibited markers.
- [x] Disabled local server returns `404` for both impact POST routes.
- [x] Enabled test state remains reversible.
- [x] Confirm Azure subscription and location with user.
- [x] Confirm plan approval with user.
- [x] Set status to `Ready for Validation` after approval.

## 6. Validation Plan

Before deployment:

- [x] All validation checks pass
  - [x] Core validation: Azure CLI installed/authenticated, exact subscription selected, live target inventory captured, deployment script syntax passes. Bicep build/ARM validate/what-if are not applicable because this is an image-only update with no IaC execution.
  - [x] Container build: ACR remote build succeeds with both Adoption & Impact flags forced false; local Docker is unavailable.
  - [x] Azure Policy validation: effective assignments at `azure-diagrams-rg` are reviewed for impact on the image-only ACA revision update.

1. Confirm Azure authentication and exact subscription context.
2. Query the live ACA, environment, registry, current revision, image digest, traffic, ingress target port, and health.
3. Review effective Azure Policy at the target scope.
4. Validate deployment script syntax and exclusion flags.
5. Run typecheck, production build, production exclusion contract, focused regression tests, and existing impact contracts.
6. Run ACR remote image build as the container-build validation because local Docker is unavailable.
7. Confirm the new image build succeeds before changing the ACA revision.
8. Record validation proof and mark status `Validated` only through the azure-validate workflow.

## 7. Validation Proof

Validated at `2026-08-18T16:16:37Z` against subscription `7a28b21e-0d3e-4435-a686-d92889d4ee96`.

| Check | Command / subject | Result |
| --- | --- | --- |
| Azure context | `az account show` | `ARTURO-MngEnvMCAP094150`, tenant `a172a259-b1c7-4944-b2e1-6d551f954711`, user `admin@MngEnvMCAP094150.onmicrosoft.com` |
| Resource inventory | Azure Container Apps MCP and ACR MCP scoped explicitly to the subscription/RG | Target `azure-diagram-builder-vnet` is `Succeeded` in East US 2/VNet environment; MCP, legacy web, and analytics apps are separate; ACR `acrazurediagrams1767583743` is present |
| Pre-deployment ACA | `az containerapp show` + revision list | Revision `azure-diagram-builder-vnet--v20260815122621`, healthy/running, target port 80, 100% traffic, image tag `:vnet` |
| Pre-deployment HTTPS | `GET https://azure-diagram-builder-vnet.thankfulbeach-7e8f01bc.eastus2.azurecontainerapps.io/` | `200` |
| Pre-deployment excluded routes | POST both impact endpoints | Both returned `404`; post-deploy requirement is that they remain `404` |
| TypeScript and Vite | `npx tsc --noEmit -p tsconfig.json`; `npm run build` | Pass; only existing Vite large-chunk warning |
| Production exclusion contract | `npm run test:production-exclusions` | Pass; no launcher text, impact API paths, impact storage keys, or impact event names in `dist/` |
| Server gate | Isolated token server with `ENABLE_ADOPTION_IMPACT=false/true` | Disabled: both routes `404`; enabled: both handlers reached (`503` without test Cosmos config), proving reversible registration |
| Impact data contracts | `npm run test:impact`; `npm run test:impact-records` | Pass |
| Functional regressions | grouped layout, edge labels, layout preservation, service names, pricing mode, ARM import, AADB v2 contract | 7/7 pass |
| Changed-file lint | ESLint on changed modules; `git diff --check` | Pass. Whole-file `App.tsx` lint still reports pre-existing `_ungroupNode` from commit `d70f4765` (2026-01-30); unrelated to this deployment change. |
| Effective policy | Azure Policy MCP at `azure-diagrams-rg` scope | 8 enforced assignments reviewed: management-group deploy/modify, deny, audit, MFA write/delete, and subscription Defender assignments; no scope expansion is required for the image-only revision update |
| ACR validation image | `BUILD_ONLY=true TAG=validation-no-impact-fixed-20260818123225 ./scripts/production/deploy-webapp.sh` | ACR run `ch66` succeeded; digest `sha256:92d644007c53e3a2f9752e29ca88e727d3ad1e20be92dce9da13b959c30e6147` |
| Image filesystem inspection | ACR run `ch67` against the exact validation image | `IMAGE_EXCLUSION_PASS`: impact route/record files absent and no prohibited client markers |
| Server dependency audit | `npm audit --omit=dev` after non-breaking lock update | 0 vulnerabilities. An intermediate ACR build (`ch65`) failed because npm rewrote resolved URLs to the managed feed; URLs were normalized to public npm coordinates, integrity hashes retained, and `npm ci` plus ACR build then passed. |
| Validation-only mutation check | `az containerapp show` after ACR build | Live ACA remained on revision `v20260815122621`, 100% traffic; no ACA mutation occurred during validation |

## 8. Deployment Plan

1. Execute the existing VNet image-only deployment script.
2. Confirm a new ACA revision is created and becomes ready/running.
3. Confirm 100% traffic targets the intended latest revision.
4. Confirm image digest differs from the prior deployed digest.
5. Verify the public HTTPS URL returns `200`.
6. Verify the Adoption & Impact launcher is absent in the browser.
7. Verify both excluded POST endpoints return `404`.
8. Verify representative diagram generation still works.
9. Verify no changes occurred to the MCP or analytics Container Apps.

## 9. Rollback

If verification fails, route traffic back to the previously healthy revision or reactivate it. Do not delete prior revisions during this deployment.

## 10. Approval

Approved by user on 2026-08-18 for subscription `7a28b21e-0d3e-4435-a686-d92889d4ee96`, East US 2, with the image-only deployment boundary described above.

## 11. Role Assignment Verification

- **Status:** Verified by static review.
- **Identity:** System-assigned managed identity of `azure-diagram-builder-vnet`.
- **Cognitive Services Speech User:** Scoped to the specific `aq-speech-008` Speech account. Matches Speech/AAD token operations in `server/token-server.js`.
- **Cosmos DB Built-in Data Contributor:** Scoped to the specific `aqcosmosdb007` account. Matches feedback read/write operations through the Cosmos data-plane SDK.
- **Azure OpenAI:** Uses the existing runtime key fallback; no new role assignment is required by this deployment.
- **Azure Resource Graph import:** Disabled by default on shared/public deployments; no management-plane Reader role is introduced by this update.
- **Post-deploy issue found:** Live verification found 18 identical Cosmos DB Built-in Data Contributor assignments for the same principal/account scope, accumulated by the non-idempotent deployment script.
- **Resolution:** User approved deletion of 17 duplicates. Assignment `ee7cdb1c-8c90-4cfe-944c-c74c546171ce` was retained and verified as the sole remaining assignment. The deployment script now checks for the exact principal/role/scope before creating an assignment.

## 12. Deployment Proof

Deployed on 2026-08-18 from merged `main` commit `a24aa4d`.

| Check | Result |
| --- | --- |
| PR and CI | PR #20 squash-merged; Vite app and MCP server CI jobs both passed |
| ACR production build | Run `ch68` succeeded; `azure-diagram-builder:vnet` digest `sha256:a5f241b11a6383057ab90cf8a9b9af9d04267b4dcd605d5cb44ec8c527114da5` |
| Target revision | `azure-diagram-builder-vnet--0000002`, healthy/running, target port 80, 100% traffic |
| Runtime gate | `ENABLE_ADOPTION_IMPACT=false` on the active ACA template |
| Exact image inspection | ACR run `ch69`: `DEPLOYED_IMAGE_EXCLUSION_PASS`; impact route/record modules absent and prohibited client markers absent |
| Public endpoint | `https://azure-diagram-builder-vnet.thankfulbeach-7e8f01bc.eastus2.azurecontainerapps.io/` returned `200` |
| Excluded endpoints | POST `/api/impact-story` and `/api/deployment-registration` both returned `404` |
| Browser verification | Adoption & Impact launcher/modal absent; Generate Diagram and Feedback remain available |
| Generation smoke | GPT-5.6 Sol/low generated 8 services and 7 edges; one Container Apps node and one Service Bus node; launcher remained absent |
| Rollback | Previous revision `azure-diagram-builder-vnet--v20260815122621` remains healthy/inactive; previous digest `sha256:57319c32449144d327c6a4b5d012d1306ed79e49b9827f5b7cb27bd59d03f593` remains in ACR |
| Scope check | Legacy web, standalone MCP, and analytics ACA revisions/images unchanged |
| Live RBAC | One Cognitive Services Speech User assignment at the Speech account; one Cosmos DB Built-in Data Contributor assignment at the Cosmos account after approved cleanup |
