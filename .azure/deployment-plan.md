# Azure Deployment Plan

> **Status:** Deployed

Generated: 2026-08-18

## 1. Project Overview

**Goal:** Redeploy the primary VNet web app and standalone MCP server from merged `main` commit `3ba152f`, delivering `@dagrejs/dagre@3.1.1` to both and the current Scout diagram-readability fixes to MCP.

**Mode:** Two independent image-only updates to existing Azure Container Apps. No infrastructure provisioning, deletion, token rotation, RBAC changes, legacy-web deployment, or analytics deployment.

## 2. Approved Deployment Boundary

User approved this boundary on 2026-08-18.

| Target | Value |
| --- | --- |
| Subscription | `7a28b21e-0d3e-4435-a686-d92889d4ee96` |
| Location | East US 2 |
| Resource group | `azure-diagrams-rg` |
| Registry | `acrazurediagrams1767583743` |
| Web ACA | `azure-diagram-builder-vnet` |
| Web image | `azure-diagram-builder:vnet` |
| Web target port | `80` |
| Web script | `scripts/vnet-migration/03-deploy-webapp.sh` |
| MCP ACA | `azure-diagram-mcp` |
| MCP image repository | `azure-diagram-mcp` |
| MCP target port | `3030` |
| MCP script | `scripts/deploy-mcp.sh` |
| Authentication | Reuse existing web secrets and existing MCP bearer token; never display or rotate token |

Out of scope: legacy `azure-diagram-builder`, `aadb-usage-analytics`, infrastructure, policy assignments, role assignments, and prior revision/image deletion.

## 3. Source Being Deployed

Merged `main` commit `3ba152f` includes:

- `@dagrejs/dagre@3.1.1` and `@dagrejs/graphlib@4.0.5` in web and MCP.
- Built-in Dagre TypeScript declarations; legacy `dagre@0.8.5` and `@types/dagre` removed.
- Scout technical-layout corridors and semantic primary/supporting composition.
- Same-source repeated-label consolidation.
- On-route label placement and ownership metadata.
- Zero-trust Scout regression fixture.
- MCP transitive dependency remediation with zero production advisories.
- Web Adoption & Impact production exclusion remains enabled from prior deployment.

## 4. Rollback Baseline

| Target | Current revision/image before deployment |
| --- | --- |
| Web | `azure-diagram-builder-vnet--0000002`; digest `sha256:a5f241b11a6383057ab90cf8a9b9af9d04267b4dcd605d5cb44ec8c527114da5` |
| MCP | `azure-diagram-mcp--v1787076992`; tag `mcp-20260818-181452`; digest `sha256:8c145b62e5a41f701c2602ac88636d73e8f641a55f5238711cd8912939e021a0` |

Both prior revisions and image digests must remain available after deployment.

## 5. Validation Plan

- [x] All validation checks pass
  - [x] Core validation: exact Azure context, target inventory, current revisions/images/traffic, script syntax, secret-file permissions, and ports 80/3030.
  - [x] Web container build-only ACR validation from `3ba152f`; verify Adoption & Impact exclusion in exact image.
  - [x] MCP container build-only ACR validation from `3ba152f`; verify health/auth runtime in exact image.
  - [x] Azure Policy review at `azure-diagrams-rg` scope.
- [x] Root clean install, Dagre migration contract, grouped layout, edge labels, layout preservation, production build.
- [x] MCP clean install, production audit, build, zero-trust fixture, render profiles, service catalog, all 13 tool contracts.
- [x] Confirm committed lockfiles contain no internal Microsoft feed URLs.
- [x] Record validation proof below and complete official azure-validate workflow.

## 7. Validation Proof

Validated at `2026-08-18T19:04:08Z` against subscription `7a28b21e-0d3e-4435-a686-d92889d4ee96`.

| Check | Result |
| --- | --- |
| Source | Merged `main` commit `3ba152f`; web and MCP resolve only `@dagrejs/dagre@3.1.1` and `@dagrejs/graphlib@4.0.5` |
| Root contracts | Clean install, Dagre migration, grouped layout, edge-label layout, layout preservation, service names, pricing mode, ARM import, AADB v2 contract, and production build pass |
| MCP contracts | Clean install, production audit (0 vulnerabilities), build, zero-trust fixture, render profiles, service catalog, and all 13 tool contracts pass |
| Lockfile hygiene | Root and MCP lockfiles contain 0 Microsoft internal-feed URLs |
| Azure context | `ARTURO-MngEnvMCAP094150`, tenant `a172a259-b1c7-4944-b2e1-6d551f954711`, user `admin@MngEnvMCAP094150.onmicrosoft.com` |
| Effective policy | 8 enforced assignments reviewed at `azure-diagrams-rg`: deploy/modify, deny, audit, MFA write/delete, and Defender assignments; no scope expansion required |
| Web pre-state | Revision `azure-diagram-builder-vnet--0000002`, digest `sha256:a5f241b11a6383057ab90cf8a9b9af9d04267b4dcd605d5cb44ec8c527114da5`, 100% traffic, target port 80 |
| MCP pre-state | Revision `azure-diagram-mcp--v1787076992`, digest `sha256:8c145b62e5a41f701c2602ac88636d73e8f641a55f5238711cd8912939e021a0`, 100% traffic, target port 3030 |
| Web validation image | Tag `validation-dagre3-web-20260818185457`, digest `sha256:407ece76eb5bb6f06b10cf998c7d0fd5e61beaa2ae4845b7d3b9e90ae622d53b`; ACR run `ch6g` verified root 200 and excluded impact route 404 after upstream readiness |
| MCP validation image | Tag `mcp-validation-dagre3-scout-20260818-190148`, digest `sha256:3557a499ab9b1d794574d4d381ead5ca9960c01b442fd02635dc1f44a16aee0c`; ACR run `ch6h` verified health 200, unauthenticated initialize 401, authenticated initialize 200 |
| Validation-only mutation check | Web remained on `0000002`; MCP remained on `v1787076992`; both remained at 100% traffic |
| Resolved validation issue | Initial web runtime probe observed transient 502 while token-server upstream started; readiness-gated rerun passed with final expected 404. No application change was required. |

## 8. Deployment Sequence

1. Deploy VNet web app from validated `main` using its existing image-only script.
2. Verify healthy ready revision, 100% traffic, HTTPS 200, Adoption & Impact absent, excluded impact endpoints 404, and representative grouped generation under Dagre 3.1.1.
3. Deploy standalone MCP using its existing image-only script.
4. Verify healthy ready revision, 100% traffic, health 200, unauthenticated initialize 401, authenticated discovery 13 tools/3 resources/3 prompts.
5. Call live `render_diagram` using the zero-trust fixture and require 11 nodes, 15 edges, 12 labels, no detached labels, and SVG ratio ≤2.4.
6. Confirm legacy web and analytics revisions/images are unchanged.
7. Confirm prior web and MCP revisions remain healthy/inactive for rollback.

## 9. Rollback

If web verification fails, reactivate/route to `azure-diagram-builder-vnet--0000002`. If MCP verification fails, reactivate/route to `azure-diagram-mcp--v1787076992`. Do not delete prior revisions or image manifests.

## 10. Role Assignment Verification

- Web: existing scoped Speech and Cosmos roles remain unchanged; deployment script's Cosmos role check is idempotent.
- MCP: identity type `None`; deterministic bundled-data server requires no Azure data-plane RBAC.
- No new role assignment is in scope.

## 11. Deployment Proof

Deployed on 2026-08-18 from merged `main` commit `3ba152f`.

| Check | Result |
| --- | --- |
| Web production image | ACR run `ch6j`; tag `azure-diagram-builder:vnet`; digest `sha256:194fb7b56093327d361b8fc9fe522a6ca4335b5d23d21560feb137aca10ce43a` |
| Web revision | `azure-diagram-builder-vnet--v20260818151122`, healthy/running, target port 80, 100% traffic |
| Web HTTP/exclusion | HTTPS 200; `/api/impact-story` and `/api/deployment-registration` both 404; `ENABLE_ADOPTION_IMPACT=false` |
| Web Dagre smoke | GPT-5.6 Sol/low zero-trust generation: 12 nodes, 5 groups, 12 edges; zero node, group, label, or label-node overlaps; Adoption launcher absent |
| Web rollback | Prior `azure-diagram-builder-vnet--0000002` remains healthy/stopped; prior digest retained in ACR |
| MCP production image | ACR run `ch6k`; tag `mcp-20260818-191355`; digest `sha256:2eb0296f97d37216bf7f81ffca9c61dfef43fb30c67f7990164df7598c76d79e`; runtime audit 0 vulnerabilities |
| MCP revision | `azure-diagram-mcp--v1787080538`, healthy/running, target port 3030, 100% traffic |
| MCP HTTP/auth | Health 200; unauthenticated initialize 401; existing bearer token reused without display/rotation |
| MCP discovery/render | 13 tools, 3 resources, 3 prompts; live zero-trust SVG: 11 nodes, 15 edges, 12 labels, 0 detached labels, ratio 2.30, consolidated 4-target monitor label |
| MCP live artifact | `DONOTTRACK/AQ-REFINEMENTS-18-aug-2026/zero-trust-network-live-dagre3-scout.svg` |
| MCP rollback | Prior `azure-diagram-mcp--v1787076992` remains healthy/stopped; prior image `mcp-20260818-181452` retained |
| Scope check | Legacy web remains `v1783874319`; analytics remains `20260813195443` |
| Final RBAC | Web Cosmos role count 1; MCP identity `None`; no assignments added |
