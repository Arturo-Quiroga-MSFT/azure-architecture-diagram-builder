# Azure Deployment Plan

> **Status:** Deployed

Generated: 2026-07-20

## 1. Project Overview

**Goal:** Build and prepare a private AADB Product Analytics web application that turns Application Insights telemetry and Cosmos DB feedback into actionable product-maintenance insights.

**Path:** Add Components

## 2. Requirements

| Attribute | Value |
| --- | --- |
| Classification | Production internal application |
| Scale | Small |
| Budget | Balanced |
| Subscription | Existing AADB subscription |
| Location | East US 2 |
| Availability | `minReplicas: 1`, `maxReplicas: 3` |

The application must use Microsoft Entra ID authentication, assignment-required access, managed identity, least-privilege Azure RBAC, HTTPS-only ingress, and server-side access to Azure Monitor Logs. Raw KQL, Azure credentials, prompts, architecture content, and access tokens must not be exposed to the browser.

## 3. Components Detected

| Component | Type | Technology | Path |
| --- | --- | --- | --- |
| Analytics dashboard | Frontend | React, TypeScript, Vite | `NEW-WEB-APP/src` |
| Analytics API | API | Node.js, Express, TypeScript | `NEW-WEB-APP/server` |
| Query registry | Data access | Azure Monitor Query Logs SDK, KQL | `NEW-WEB-APP/server/analytics` |
| Product telemetry | Shared contract | Application Insights custom events | `src/services/telemetryService.ts` |
| Existing analytics | Query reference | Azure Workbook JSON | `scripts/workbook-content.json` |

## 4. Recipe Selection

**Selected:** Script-driven Bicep and Azure CLI

**Rationale:** The analytics application must not use azd or project templates. Explicit shell scripts will build the image with ACR Tasks, provision resources with resource-group-scoped Bicep, update the Container App, and verify health. The existing root `azure.yaml` remains unchanged. The application reuses the existing Container Apps environment, ACR, and source Log Analytics workspace.

## 5. Architecture

**Stack:** Single Azure Container App hosting a static React dashboard and Node.js API.

| Component | Azure Service | SKU |
| --- | --- | --- |
| Analytics web/API container | Azure Container Apps | Consumption, 0.5 vCPU / 1 GiB, min 1, max 3 |
| Container image | Existing Azure Container Registry | Existing Basic registry |
| Runtime identity | User-assigned managed identity | Dedicated analytics identity |
| Source telemetry | Existing workspace-based Application Insights | Existing |
| Query plane | Existing Log Analytics workspace | Existing PerGB2018 |
| Analytics observability | Application Insights | Workspace-based, existing workspace |
| Authentication | Container Apps built-in auth with Microsoft Entra ID | Single tenant, assignment required |

The API uses `DefaultAzureCredential` and `LogsQueryClient`. Its managed identity receives Log Analytics Reader on the source workspace. KQL is stored in a named, typed server-side query registry. API routes validate filters, cap time ranges and rows, batch compatible queries, and cache aggregates briefly. Optional AI recommendations consume only pre-aggregated analytics summaries and are disabled unless an Azure OpenAI endpoint and deployment are configured.

## 6. Provisioning Limit Checklist

This change reuses the existing Container Apps managed environment, ACR, Log Analytics workspace, and network. It creates one Container App, one user-assigned identity, one Application Insights component, and three role assignments. These resource types do not consume regional compute-family quota. The existing Container Apps environment supports additional apps, and the requested steady-state replica count is one.

| Resource Type | Number to Deploy | Total After Deployment | Limit/Quota | Notes |
| --- | --- | --- | --- | --- |
| `Microsoft.App/containerApps` | 1 | Existing count + 1 | Environment/platform limit, not vCPU family quota | Reuses existing East US 2 environment; 1 minimum replica |
| `Microsoft.ManagedIdentity/userAssignedIdentities` | 1 | Existing count + 1 | Subscription resource limit | Dedicated least-privilege identity |
| `Microsoft.Insights/components` | 1 | Existing count + 1 | Subscription resource limit | Uses existing workspace |
| `Microsoft.Authorization/roleAssignments` | 3 | Existing count + 3 | 4,000 per subscription | ACR pull, Log Analytics Reader, optional Cosmos read |

**Status:** All planned resources are within documented platform limits; no scarce SKU or regional vCPU quota is requested. Live subscription preflight remains required before deployment.

## 7. Execution Checklist

### Phase 1: Planning

- [x] Analyze workspace
- [x] Gather requirements
- [x] Confirm existing deployment location from repository deployment configuration
- [x] Prepare resource inventory
- [x] Scan codebase and existing workbook
- [x] Select recipe
- [x] Plan architecture
- [x] User approved the architecture and requested full implementation

### Phase 2: Execution

- [x] Generate application scaffold and dependencies
- [x] Implement telemetry contract and typed query registry
- [x] Implement secured analytics API, caching, and health endpoints
- [x] Implement dashboard, filters, drilldowns, and recommendation views
- [x] Add telemetry schema and API tests
- [x] Generate Docker and Bicep deployment artifacts
- [x] Add script-driven provision, deploy, and verification commands
- [x] Run local build, lint, tests, and container validation
- [x] Set status to `Ready for Validation`

### Phase 3: Validation

- [x] Invoke Azure validation workflow
- [x] Validate Bicep and deployment prerequisites
- [x] Record validation proof

### Phase 4: Deployment

- [x] Confirm live Azure subscription and Entra application parameters
- [x] Deploy with Azure deployment workflow
- [x] Verify authenticated endpoint and telemetry queries
- [x] Set status to `Deployed`

## 8. Validation Proof

| Check | Command Run | Result | Timestamp |
| --- | --- | --- | --- |
| Lint | `npm run lint` | Pass, zero warnings | 2026-07-20 |
| TypeScript and Vite | `npm run build` | Pass | 2026-07-20 |
| API contracts | `npm test` | Pass, 4 tests | 2026-07-20 |
| Shell syntax | `bash -n scripts/*.sh` | Pass | 2026-07-20 |
| Bicep compilation | `az bicep build --file infra/main.bicep` | Pass | 2026-07-20 |
| Production image | `docker build -t aadb-product-analytics:local .` | Pass | 2026-07-20 |
| Runtime health | `GET /api/health` in production container | Pass, healthy | 2026-07-20 |
| Browser workflow | Playwright navigation and responsive checks | Pass, 8 views and named controls | 2026-07-20 |
| Azure context | `az account show` and read-only resource resolution | Pass, ARTURO-MngEnvMCAP094150 / East US 2 | 2026-07-20 |
| ARM group validation | `az deployment group validate -g azure-diagrams-rg -f infra/main.bicep ...` | Pass, provisioning state Succeeded | 2026-07-20 |
| ARM what-if | `az deployment group what-if -g azure-diagrams-rg -f infra/main.bicep ...` | Pass, 6 creates / 15 ignores / 0 modifies / 0 deletes | 2026-07-20 |
| Production deployment | `scripts/01-provision.sh` and `scripts/02-deploy.sh` | Pass, authenticated Container App deployed | 2026-07-20 |
| Authentication callback | Entra browser login with ID token issuance enabled | Pass | 2026-07-20 |
| AADB telemetry source | In-container `GET /api/analytics/overview?range=90d` | Pass, 1,152 users / 1,601 sessions / 10,892 events | 2026-07-20 |
| Decision intelligence | In-container `GET /api/analytics/insights?range=90d` | Pass, funnel/models/findings/reliability/cohorts/actions populated | 2026-07-20 |
| Cosmos feedback | Authenticated Feedback view using `diagrams-db/feedback` | Pass | 2026-07-20 |

## 9. Files to Generate

| File | Purpose | Status |
| --- | --- | --- |
| `.azure/deployment-plan.md` | Deployment source of truth | Complete |
| `NEW-WEB-APP/package.json` | Application scripts and dependencies | Complete |
| `NEW-WEB-APP/src/` | Product analytics dashboard | Complete |
| `NEW-WEB-APP/server/` | Analytics API and KQL registry | Complete |
| `NEW-WEB-APP/Dockerfile` | Production image | Complete |
| `NEW-WEB-APP/infra/` | Resource-group-scoped Bicep | Complete |
| `NEW-WEB-APP/scripts/` | Azure CLI setup, deployment, and verification | Complete |

## 10. Next Steps

1. Use the deployed application at `https://aadb-usage-analytics.thankfulbeach-7e8f01bc.eastus2.azurecontainerapps.io`.
2. Grant additional maintainers with `scripts/04-grant-access.sh <user-upn>`.
3. Deploy future application revisions with `scripts/02-deploy.sh`.
