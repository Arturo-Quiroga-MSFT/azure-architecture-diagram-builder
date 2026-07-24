# AADB Physical Architecture Studio — Technical Preview

A focused prototype that turns a regulated-AI workload description into a
**deterministic physical Azure architecture**: hub/spoke VNets, subnets with real
CIDRs, private endpoints with allocated IPs, private DNS, and traceable
**AVM-aligned Bicep + Terraform** — validated locally.

> **Positioning:** This preview demonstrates how AADB could move from *concept*
> architecture to *deterministic physical design* aligned to Azure Landing Zones
> and AI Landing Zones, with AVM-based IaC validated locally. It is **not** a
> production-ready sovereign-certification tool.

## Why it matters

Diagram generators produce *plausible prose*. This studio produces *facts*:
address allocation, overlap detection, and IaC emission are pure deterministic
code (no LLM in the loop). An identical manifest always yields identical Bicep,
Terraform, IP plan, and diagram. Overlaps are caught by math, with exact
conflicting ranges — as the "Inject overlap" demo shows.

## Architecture

```
Intent ──(LLM draft, optional)──▶ Physical Manifest ──▶ deterministic core
                                                          ├─ IPAM / CIDR validation
                                                          ├─ Diagram scene (concept ↔ physical)
                                                          ├─ AVM-aligned Bicep
                                                          ├─ AVM-aligned Terraform
                                                          ├─ IP plan (CSV)
                                                          └─ Traceability map
```

The **manifest** (`core/manifest/schema.ts`) is the single source of truth. It
models a **platform** landing zone (connectivity hub: Azure Firewall, gateway,
DNS) and one or more **application** landing zones (workload spokes: subnets,
private endpoints, services), mirroring CAF Enterprise-Scale.

## Layout

| Path | Purpose |
|------|---------|
| `core/manifest/` | Zod schema + Private Link group-id mapping |
| `core/ipam/` | Deterministic CIDR/IPAM engine (overlap, capacity, PE allocation) |
| `core/validation/` | Schema + IPAM orchestrator |
| `core/bicep/`, `core/terraform/` | AVM-aligned IaC emitters |
| `core/export/` | IP-plan CSV |
| `core/diagram/` | Concept + physical scene builder |
| `core/traceability/` | Diagram ↔ Bicep ↔ Terraform map |
| `scenarios/` | Golden scenario: regulated AI knowledge assistant |
| `src/` | React + Vite SPA (imports the core client-side) |
| `server/` | Express host (static + health + JSON API mirror) |
| `infra/` | Container App Bicep (reuses existing ACA env, dedicated MI) |
| `scripts/` | `emit.ts`, `validate-local.sh`, `deploy.sh` (gated) |
| `tests/` | Vitest unit + snapshot tests |

## Develop

```bash
npm install
npm run test          # deterministic core tests
npm run dev           # Vite dev server (client runs the core)
npm run dev:server    # Express API on :8080 (optional)
```

## Local validation (no Azure write access)

```bash
./scripts/validate-local.sh   # tests + emit + az bicep build + terraform validate
```

Live `az deployment group what-if` requires the same write permissions as a
deploy and is therefore an **operator-run** step, out of scope for the app
identity.

## Deploy (gated)

Deployment is gated behind the approval in `.azure/deployment-plan.md`:

```bash
PAS_DEPLOY_CONFIRM=yes \
RESOURCE_GROUP=azure-diagrams-rg \
ACR_NAME=<acr> ACA_ENV_ID=<env-resource-id> \
./scripts/deploy.sh
```

Reuses the existing ACR and Container Apps environment, a dedicated
user-assigned managed identity, `minReplicas=1`, and Entra
(assignment-required) auth configured at the ingress.
