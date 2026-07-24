# Azure Deployment Plan

> **Status:** Implemented (local) — Deployment gated pending approval

Generated: 2026-07-24

## Project

**Name:** AADB Physical Architecture Studio

**Path:** `physical-architecture-studio/`

**Goal:** A separate, Entra-protected technical preview that turns a regulated-AI workload into a deterministic physical Azure manifest, validates CIDR/network policy, renders concept-to-physical architecture, and emits traceable Bicep/Terraform/IP-plan artifacts — validated locally.

## Planning Gates

- [x] Source plan captured in `DONOTTRACK/PHYSICAL-ARCHITECTURE-STUDIO/PLAN-24-july-2026.md`
- [x] Azure/AI + ALZ best practices researched (Enterprise-Scale, AI Landing Zones, AVM)
- [x] Reference scenario finalized — regulated AI knowledge assistant (AI Foundry LZ)
- [x] Deterministic core implemented (manifest, IPAM, validation, Bicep, Terraform, IP plan, diagram, traceability)
- [x] SPA + Express host implemented and smoke-tested locally
- [x] Generated Bicep compiles (`az bicep build`); 22 unit/snapshot tests pass
- [ ] **User approves Azure deployment** (gate)
- [ ] Container App deployed and Entra auth configured

## Implemented decisions

- Golden scenario: AI Foundry Landing Zone (APIM AI Gateway = stretch)
- IaC: AVM-aligned module calls (Bicep `br/public:avm/res/network/*`, Terraform `Azure/avm-res-network-*`)
- Validation: LOCAL only (`az bicep build`, `terraform validate`); what-if is operator-run
- App identity: dedicated user-assigned MI with **no infrastructure write rights**

## Deployment recipe (when approved)

- Reuse existing ACR + Container Apps environment (`azure-diagrams-rg`, eastus2)
- `az acr build` image → `az deployment group create` with `infra/main.bicep`
- `minReplicas=1`; liveness probe on `/healthz`
- Configure Entra (assignment-required) auth via `az containerapp auth`
- Runner: `scripts/deploy.sh` (requires `PAS_DEPLOY_CONFIRM=yes`)

## Current Decision

Implementation and local validation are complete. **No Azure resources will be created until the deployment gate above is approved.**
