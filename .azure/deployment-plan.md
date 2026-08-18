# Azure Deployment Plan

> **Status:** Deployed

Generated: 2026-08-18

## 1. Project Overview

**Goal:** Deploy the Scout MCP diagram-quality improvements from commit `42e0b75` to the existing standalone Azure Architecture Diagram Builder MCP Container App for Microsoft Scout testing.

**Mode:** Image-only update to an existing standalone MCP deployment. No infrastructure provisioning, deletion, web-app deployment, analytics deployment, or token rotation.

## 2. Deployment Boundary

| Attribute | Value |
| --- | --- |
| Application | `azure-diagram-mcp` |
| Resource group | `azure-diagrams-rg` |
| Subscription | `7a28b21e-0d3e-4435-a686-d92889d4ee96` (confirmation required) |
| Location | East US 2 (confirmation required) |
| Container Apps environment | Existing environment resolved by deployment script |
| Registry | `acrazurediagrams1767583743` |
| Image repository | `azure-diagram-mcp` |
| Ingress target port | `3030` |
| MCP endpoint | `https://azure-diagram-mcp.yellowmushroom-f11e57c2.eastus2.azurecontainerapps.io/mcp` |
| Health endpoint | `https://azure-diagram-mcp.yellowmushroom-f11e57c2.eastus2.azurecontainerapps.io/healthz` |
| Deployment method | Existing `scripts/deploy-mcp.sh` |
| Authentication | Reuse existing bearer token from gitignored `.env.mcp`; do not display or rotate it |
| Rollback | Preserve prior healthy revision `azure-diagram-mcp--v1786890197` and prior image tag `mcp-20260816-142135` |

Out of scope: `azure-diagram-builder-vnet`, legacy `azure-diagram-builder`, `aadb-usage-analytics`, all infrastructure, RBAC, and the MCP bearer token value.

## 3. Change Being Deployed

- Reserve label-sized corridors for technical LR grouped diagrams.
- Reflow grouped technical diagrams into DMZ/Application/Data primary row plus Identity/Security supporting row.
- Consolidate repeated same-source labels while preserving all edges.
- Keep labels on sampled points of their owning orthogonal path.
- Add edge ownership/placement metadata to SVG labels.
- Add the reported zero-trust Scout graph as a permanent regression fixture.

## 4. Recipe Selection

**Selected:** Existing script-driven ACR build plus image-only Azure Container Apps update.

**Rationale:** The standalone MCP app already exists and is healthy. `scripts/deploy-mcp.sh` builds a unique image tag, updates only `azure-diagram-mcp`, preserves prior revisions, reuses the existing bearer token, and forces a new ACA revision. Full provisioning or `azd up` would expand scope unnecessarily.

## 5. Preparation Checklist

- [x] Current branch is `feature/scout-mcp-diagram-quality` at commit `42e0b75`.
- [x] Worktree was clean before deployment-plan preparation.
- [x] `.env.mcp` exists with mode `0600`.
- [x] Local Docker is unavailable; use ACR build-only validation.
- [x] Exact zero-trust regression passes.
- [x] Render-profile regression passes.
- [x] Service-catalog and all 13 MCP tool contracts pass.
- [x] TypeScript diagnostics and diff checks pass.
- [x] Confirm subscription/location with user.
- [x] Confirm image-only deployment approval.
- [ ] Complete Azure validation workflow.

## 6. Validation Plan

- [x] All validation checks pass
  - [x] Core validation: exact Azure context, live target inventory, target port 3030, source commit, script syntax, secret-file permissions, and pre-deploy health/auth behavior.
  - [x] Container build: build unique validation image in ACR; do not update ACA during validation.
  - [x] Azure Policy review at `azure-diagrams-rg` scope.
- [x] Run MCP build, zero-trust fixture, render profiles, service catalog, and all tool contracts.
- [x] Verify validation image starts on port 3030 and `/healthz` succeeds using ACR Tasks.
- [x] Verify unauthenticated MCP requests are rejected and authenticated initialization/tool discovery succeeds against the current live endpoint before deployment.
- [x] Record exact validation image tag/digest and proof in Section 7.

## 7. Validation Proof

Validated at `2026-08-18T18:12:10Z` against subscription `7a28b21e-0d3e-4435-a686-d92889d4ee96`.

| Check | Command / subject | Result |
| --- | --- | --- |
| Azure context | `az account show` | `ARTURO-MngEnvMCAP094150`, tenant `a172a259-b1c7-4944-b2e1-6d551f954711`, user `admin@MngEnvMCAP094150.onmicrosoft.com` |
| Source | Git branch and status | Renderer commit `42e0b75`; dependency lock remediation pending commit on same feature branch; `.env.mcp` present with mode `0600` |
| Pre-deploy ACA | `az containerapp show` and revision list | `azure-diagram-mcp--v1786890197`, healthy/running, target port 3030, image `mcp-20260816-142135`, 100% traffic; prior revisions retained |
| Pre-deploy HTTP/auth | Health plus unauthenticated initialize | `/healthz` `200`; unauthenticated initialize `401` |
| Authenticated discovery | MCP SDK using existing token without printing it | 13 tools, 3 resources, 3 prompts; `render_diagram` present |
| Source contracts | Build, zero-trust fixture, render profiles, service catalog, tool contracts | All pass; zero-trust render 11 nodes / 15 edges / 12 labels / no detached labels / document-friendly composition |
| Dependency audit | `npm audit --omit=dev` | Initial validation found 5 high and 3 moderate production advisories. Non-breaking transitive updates were applied within declared ranges; `npm ci`, build, and all contracts pass; final audit reports 0 vulnerabilities. Lockfile contains 0 internal feed URLs. |
| Effective policy | Azure Policy MCP at `azure-diagrams-rg` scope | 8 enforced assignments reviewed (deploy/modify, deny, audit, MFA write/delete, Defender); no scope expansion required for image-only revision update |
| Validation image | ACR run `ch6a` | Tag `mcp-validation-diagram-quality-20260818-181004`; digest `sha256:a9ddf229bba6fd88fa6220934d73512e8b1220bdf5ee7c5a4ec2cce76931655c`; build and push succeeded |
| Validation image runtime | ACR run `ch6b` | Exact image started on port 3030; health `200`; unauthenticated initialize `401`; authenticated initialize `200` |
| Validation-only mutation check | `az containerapp show` after ACR runs | Live ACA remained on `v1786890197`, image `mcp-20260816-142135`, 100% traffic |

## 8. Deployment Plan

1. Execute `scripts/deploy-mcp.sh` from the validated source commit.
2. Confirm a unique image tag and digest are pushed to ACR.
3. Confirm a new healthy/running ACA revision becomes latest ready.
4. Confirm 100% traffic targets the latest revision.
5. Verify target port remains 3030 and health endpoint returns 200.
6. Verify unauthenticated `/mcp` session operations return 401.
7. Using the existing token without displaying it, initialize an MCP session and confirm 13 tools, 3 resources, and 3 prompts.
8. Call `render_diagram` with the zero-trust regression graph and verify technical SVG includes 11 nodes, 15 edges, 12 consolidated labels, no detached labels, and a viewBox ratio no greater than 2.4.
9. Verify web, legacy web, and analytics ACA revisions/images are unchanged.
10. Verify previous MCP revision remains available for rollback.

## 9. Rollback

If verification fails, reactivate or route traffic to `azure-diagram-mcp--v1786890197`, which uses image `azure-diagram-mcp:mcp-20260816-142135`. Do not delete prior revisions or tags.

## 10. Approval

Approved by user on 2026-08-18 for subscription `7a28b21e-0d3e-4435-a686-d92889d4ee96`, East US 2, with the image-only standalone MCP boundary described above.

## 11. Role Assignment Verification

- **Status:** Verified; no Azure data-plane RBAC is required by this application.
- **Live identity:** `azure-diagram-mcp` reports identity type `None`.
- **Runtime operations:** The MCP server is deterministic and reads bundled icon, pricing, catalog, and ARM parsing data. It does not call Azure APIs or data-plane services.
- **Authentication:** MCP bearer token stored as an ACA secret; no token value is written to source or logs.
- **Registry:** Existing ACR credential configuration remains unchanged; no role assignment is created by this image-only update.
- **Issues:** None.

## 12. Deployment Proof

Deployed on 2026-08-18 from feature-branch commit `7711810`.

| Check | Result |
| --- | --- |
| ACR production build | Run `ch6c` succeeded; tag `mcp-20260818-181452`; digest `sha256:8c145b62e5a41f701c2602ac88636d73e8f641a55f5238711cd8912939e021a0`; runtime install reported 0 vulnerabilities |
| Target revision | `azure-diagram-mcp--v1787076992`, healthy/running, target port 3030, 100% traffic |
| Public health | `https://azure-diagram-mcp.yellowmushroom-f11e57c2.eastus2.azurecontainerapps.io/healthz` returned `200` |
| Authentication | Unauthenticated initialize returned `401`; existing bearer token was reused without display or rotation |
| Authenticated discovery | 13 tools, 3 resources, 3 prompts; `render_diagram` present |
| Live render call | Exact zero-trust fixture through deployed `render_diagram`: 11 nodes, 15 edges, 12 labels, 0 detached labels, viewBox `1818×790` (ratio 2.30), consolidated `Monitor security posture · 4 targets` label present |
| Live artifact | `DONOTTRACK/AQ-REFINEMENTS-18-aug-2026/zero-trust-network-live-mcp.svg` |
| Scope check | Legacy web `v1783874319`, VNet web `0000002`, and analytics `20260813195443` revisions/images unchanged |
| Rollback | Prior MCP revision `azure-diagram-mcp--v1786890197` is healthy/stopped; prior image `mcp-20260816-142135` retained |
