# Deployment Guide — Model Comparison

## Test Setup

**Architecture Under Test:** Healthcare Imaging Event Pipeline with Key Vault Security  
**Azure Services in Diagram:** 11 (VPN Gateway, Event Hubs, Service Bus, Azure Functions, Cosmos DB, Storage Account, Key Vault, Log Analytics, Virtual Machines, Microsoft Entra ID)  
**Feature Tested:** Deployment Guide generation (markdown guide + Bicep templates)  
**Date:** 2026-02-12  
**Same diagram used across all four runs**

---

## Summary Table

| Metric | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| **Generation Time** | 55s | 67s | 212s | 185s |
| **Token Output** | — | — | — | 11,345 |
| **Guide Word Count** | 768 | 689 | 1,127 | 1,330 |
| **Deployment Steps** | 6 | 5 | 5 | 7 |
| **Bicep Modules** | 9 | 11 | 11 | 11 + 1 (roleAssignments) |
| **Bicep Lines of Code** | 489 | 359 | 886 | 1,001 |
| **Troubleshooting Scenarios** | 4 | 5 | 6 | 7 |
| **Post-Deploy Validations** | 6 | 5 | 8 | 9 |
| **Configuration Tables** | 1 | 3 | 2 | 3 |
| **Estimated Cost** | $90.90/mo | $90.90/mo | $90.90/mo | $90.90/mo |

---

## Generation Speed

| Model | Time | Relative |
|---|:---:|:---:|
| GPT-4.1 Mini | 55s | 1.0× (baseline) |
| GPT-4.1 | 67s | 1.2× |
| GPT-5.2 Medium | 185s | 3.4× |
| GPT-5.2 Low | 212s | 3.9× |

GPT-4.1 variants are **3-4× faster** than GPT-5.2 variants. Interestingly, GPT-5.2 Medium was faster than GPT-5.2 Low (185s vs 212s) despite producing more output.

---

## Deployment Guide Quality

### Guide Structure

| Section | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| Overview with service list | ✅ | ✅ | ✅ | ✅ |
| Prerequisites | ✅ (5 items) | ✅ (7 items) | ✅ (7 items) | ✅ (8 items) |
| Step-by-step commands | ✅ | ✅ | ✅ | ✅ |
| Inline tips (💡) per step | ❌ | ✅ (brief) | ✅ (detailed) | ✅ (detailed) |
| Configuration tables | ✅ (1) | ✅ (3) | ✅ (2) | ✅ (3) |
| Post-deploy checklist | ✅ (6) | ✅ (5) | ✅ (8) | ✅ (9) |
| Troubleshooting | ✅ (4) | ✅ (5) | ✅ (6) | ✅ (7) |

### Deployment Steps Comparison

| Step | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| Login & set subscription | ✅ | ✅ | ✅ | ✅ |
| Set env variables / parameters | ❌ | ✅ (2 vars) | ✅ (10 vars) | ✅ (8 vars) |
| Create resource group | ✅ | ❌ (sub-level deploy) | ✅ | ✅ |
| What-if validation | ❌ | ❌ | ❌ | ✅ |
| Deploy Bicep | ✅ | ✅ | ✅ | ✅ |
| Retrieve outputs | ❌ | ✅ (generic) | ❌ | ✅ (specific) |
| Configure VPN device | ❌ | ❌ | ❌ | ✅ |
| Verify Key Vault access | ✅ (manual) | ❌ | ❌ | ❌ (in RBAC module) |
| Configure managed identities | ✅ (manual) | ❌ | ❌ | ❌ (in Bicep) |
| Entra ID app registration | ✅ (placeholder) | ❌ | ✅ (full CLI) | ❌ |

**Key Insight:** GPT-5.2 Medium is the only model that includes a `what-if` validation step and on-prem VPN device configuration step — critical for real-world deployments.

### Troubleshooting Depth

| Issue | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| Key Vault access denied | ✅ (1 sentence) | ✅ (1 sentence) | ✅ (detailed — RBAC, secret URI, identity) | ✅ (detailed — RBAC role name, scope) |
| VPN not connecting | ✅ (generic) | ✅ (generic) | ✅ (timeout, GatewaySubnet sizing) | ✅ (IKE/IPsec, NSG/UDR, UDP ports) |
| Event Hub auth failure | ✅ (generic) | ✅ (generic) | ✅ (AAD vs SAS, RBAC role, audience) | ✅ (Entra role + scope) |
| Storage access denied | ✅ (generic) | ✅ (generic) | ❌ | ✅ (specific RBAC role + credential) |
| Cosmos DB access denied | ✅ (same as Storage) | ✅ (same as Storage) | ❌ | ✅ (built-in role, Entra RBAC) |
| No logs in Log Analytics | ❌ | ✅ (1 sentence) | ✅ (resource-specific tables) | ✅ (5-15 min ingestion delay) |
| AzureWebJobsStorage runtime | ❌ | ❌ | ✅ (KV reference + network) | ❌ |
| AuthorizationFailed on RBAC | ❌ | ❌ | ✅ | ✅ |

---

## Bicep Template Quality

### Quantitative Metrics

| Metric | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| **Total lines of Bicep** | 489 | 359 | 886 | 1,001 |
| **Modules** | 9 | 11 | 11 | 11 + roleAssignments |
| **`@secure()` decorators** | 0 | 0 | 8 | 4 |
| **`@description()` annotations** | 0 | 0 | 8 | 28 |
| **Diagnostic settings** | 0 | 0 | 3 | 4 |
| **RBAC role assignments** | 0 | 0 | 1 | 9 |
| **Managed identity refs** | 2 | 4 | 3 | 7 |

### Security Features in Bicep

| Feature | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| `@secure()` on passwords/keys | ❌ | ❌ | ✅ | ✅ |
| Key Vault RBAC authorization | ❌ | ❌ | ✅ | ✅ |
| Function → KV RBAC assignment | ❌ | ❌ | ✅ (dedicated module) | ✅ (reusable module) |
| Function → Storage RBAC | ❌ | ❌ | ❌ | ✅ |
| Function → Service Bus RBAC | ❌ | ❌ | ❌ | ✅ (sender + receiver) |
| Function → Event Hubs RBAC | ❌ | ❌ | ❌ | ✅ (sender + receiver) |
| Function → Cosmos DB RBAC | ❌ | ❌ | ❌ | ✅ |
| Diagnostic settings to Log Analytics | ❌ | ❌ | ✅ (EH, SB) | ✅ (EH, SB, Storage, Cosmos) |
| Key Vault secrets module | ❌ | ❌ | ✅ (dedicated module) | ❌ (RBAC-only approach) |

**Key Insight:** GPT-5.2 Medium produces a comprehensive RBAC-first design with **9 role assignments** covering all data-plane access (Key Vault, Storage, Service Bus, Event Hubs, Cosmos DB) — eliminating the need for connection strings entirely. GPT-5.2 Low takes a hybrid approach (Key Vault secrets + 1 RBAC). GPT-4.1 variants produce no RBAC assignments at all.

### Architectural Patterns in Bicep

| Pattern | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| Modular (main + modules/) | ✅ | ✅ | ✅ | ✅ |
| Resource naming convention | Hardcoded | Prefix-based | Deterministic vars | Parameterized baseName |
| Tags on all resources | ❌ (via params) | ❌ (no tags param) | ✅ | ✅ |
| Parameter validation (`@allowed`) | ❌ | ❌ | ✅ (env) | ❌ |
| Deployment outputs | ✅ (7) | ✅ (6) | ✅ (7) | ✅ (10) |
| Reusable role assignment module | ❌ | ❌ | ❌ | ✅ |
| BGP support (VPN) | ❌ | ❌ | ❌ | ✅ |
| Entra ID module | ❌ | ✅ | ❌ | ❌ (in roleAssignments) |

### Notable Issues

| Issue | Model |
|---|---|
| `scope: rg` with `existing` resource — may fail if targetScope isn't subscription | GPT-4.1 Mini |
| No `@secure()` on VPN shared key or VM password | GPT-4.1, GPT-4.1 Mini |
| Outputs Cosmos connection string (secret in deployment output) | GPT-4.1 |
| Cosmos DB `primaryKey` output (secret leak in Bicep outputs) | GPT-5.2 Low |
| Placeholder role ID for Cosmos RBAC (needs real built-in role GUID) | GPT-5.2 Medium |

---

## Configuration & Security Philosophy

| Approach | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|---|---|---|---|
| **Auth model** | Key Vault access policies (manual) | Key Vault URI passed to modules | Key Vault RBAC + secret references | Full RBAC — no connection strings |
| **Secret handling** | KV references in app settings | Secrets stored in KV (no detail) | KV secrets module populates values | RBAC eliminates most secrets |
| **Identity strategy** | Manual `az functionapp identity assign` | Implicit | SystemAssigned in Bicep | SystemAssigned + 7 RBAC grants |
| **Function app settings** | KV SecretUri references (hardcoded vault name) | Generic placeholders | `@Microsoft.KeyVault(SecretUri=...)` | FQDN-based (Entra auth preferred) |
| **VPN parameters** | None (no VPN config detail) | No shared key handling | `@secure()` shared key | `@secure()` + BGP support |

---

## Post-Deployment Validation

| Validation | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| Resource list check | ✅ | ❌ | ✅ | ❌ |
| VPN Gateway state | ❌ | ✅ | ✅ (provisioning state) | ✅ (connection state) |
| Event Hubs namespace | ❌ | ✅ | ✅ (namespace + hub) | ✅ (+ diagnostics) |
| Service Bus namespace | ❌ | ❌ | ✅ (namespace + queue) | ✅ |
| Function App + identity | ✅ | ❌ | ✅ (query identity) | ✅ (SystemAssigned) |
| Key Vault secrets | ❌ | ✅ | ✅ (secret list) | ✅ (RBAC test) |
| Cosmos DB connectivity | ❌ | ✅ | ❌ | ✅ (app test) |
| Storage blob write | ❌ | ❌ | ❌ | ✅ (managed identity test) |
| Log Analytics ingestion | ✅ | ✅ | ✅ | ✅ |
| Alert setup | ❌ | ❌ | ✅ | ✅ |
| **Total checks** | **3** | **5** | **8** | **9** |

---

## Conclusions

### 1. Speed vs. Depth Tradeoff

| Model | Generation Time | Bicep LoC | RBAC Assignments | Practical Readiness |
|---|:---:|:---:|:---:|---|
| GPT-4.1 Mini | 55s | 489 | 0 | Scaffold only — needs manual security |
| GPT-4.1 | 67s | 359 | 0 | Scaffold only — needs manual security |
| GPT-5.2 Low | 212s | 886 | 1 | Hybrid (KV secrets + partial RBAC) |
| GPT-5.2 Medium | 185s | 1,001 | 9 | Production-ready security posture |

### 2. Security Posture

GPT-5.2 Medium is the **only model** that produces a deployment with:
- Full RBAC role assignments for all data-plane access (7 services)
- `@secure()` decorators on all sensitive parameters
- `@description()` annotations on all parameters (28 total)
- Diagnostic settings for 4 services
- No connection strings needed at runtime

GPT-4.1 and GPT-4.1 Mini produce **zero** `@secure()` decorators, **zero** RBAC assignments, and **zero** diagnostic settings — the Bicep would deploy but without security controls.

### 3. Guide Completeness

GPT-5.2 Medium is the only guide that includes:
- **What-if validation** before deployment
- **On-prem VPN device configuration** step
- **BGP support** in parameters
- **Retrieve outputs** step for downstream configuration

GPT-5.2 Low uniquely includes:
- **Entra ID app registration** with full CLI commands for Event Hubs OAuth
- **AzureWebJobsStorage** troubleshooting (common real-world issue)

### 4. Recommendation

| Use Case | Best Model |
|---|---|
| Quick prototype / learning | GPT-4.1 (fastest, readable) |
| Starting scaffold to customize | GPT-4.1 Mini (55s, modular) |
| Production with Key Vault secrets | GPT-5.2 Low (hybrid security, Entra ID app setup) |
| Production with full RBAC | GPT-5.2 Medium (zero-trust, comprehensive RBAC) |
| Presentation / demo | GPT-5.2 Medium (most complete, best structured) |

### 5. Bottom Line

GPT-5.2 Medium produces **2.8× more Bicep code** and takes **3.4× longer** than GPT-4.1 — but the output is fundamentally different in kind, not just quantity. The GPT-4.1 templates are code *scaffolds*; the GPT-5.2 Medium templates are *deployable infrastructure* with security controls built in.

---

## Test Artifacts

| Model | Guide File | Bicep Folder |
|---|---|---|
| GPT-4.1 Mini (55s) | `deployment-guide-1770939206643-gpt41mini-55-seconds.md` | `bicep-templates-1770939214582-gpt41mini/` |
| GPT-4.1 (67s) | `deployment-guide-1770938945151-gpt41-67-seconds.md` | `bicep-templates-1770938949611-gpt41/` |
| GPT-5.2 Low (212s) | `deployment-guide-1770938200458-gpt52-low-212-seconds.md` | `bicep-templates-1770938209485-gpt52-low/` |
| GPT-5.2 Medium (185s) | `deployment-guide-1770933670288-gpt52-medium-185-seconds.md` | `bicep-templates-1770933682052-gpt52-medium/` |

---

*Report generated: 2026-02-12*  
*Azure Architecture Diagram Builder — Model Comparison Series*
