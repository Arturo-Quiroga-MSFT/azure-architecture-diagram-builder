# Architecture Validation — Model Comparison

## Test Setup

**Architecture Under Test:** Healthcare Imaging Event-Driven Pipeline  
**Azure Services in Diagram:** 11 (Event Hubs, Service Bus, Azure Functions, Cosmos DB, Storage Account, Key Vault, Log Analytics, Microsoft Entra ID, VPN Gateway, Virtual Machines)  
**Validation Framework:** Azure Well-Architected Framework (5 Pillars)  
**Date:** 2026-02-12  
**Same diagram used across all three runs** (with diagram screenshot captured in each report)

---

## Summary Table

| Metric | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|
| **Overall Score** | 78/100 | 72/100 | 74/100 |
| **Reliability** | 72 | 68 | 68 |
| **Security** | 85 | 70 | 72 |
| **Cost Optimization** | 74 | 73 | 73 |
| **Operational Excellence** | 78 | 74 | 74 |
| **Performance Efficiency** | 80 | 75 | 83 |
| **Total Findings** | 10 | 21 | 20 |
| **HIGH Severity** | 2 | 7 | 6 |
| **MEDIUM Severity** | 6 | 10 | 11 |
| **LOW Severity** | 2 | 4 | 3 |
| **Quick Wins** | 3 | 6 | 5 |

---

## Scoring Philosophy

| Aspect | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|---|---|---|
| **Approach** | Generous — rewards what's present | Strict — penalizes what's missing | Balanced strict — penalizes gaps but credits strengths |
| **Security Score** | 85 (credits Key Vault + Entra ID presence) | 70 (penalizes no private endpoints, key-based access, no CMK) | 72 (same gaps, slightly more credit for existing controls) |
| **Overall Tone** | "Strong foundation with some gaps" | "Solid but key gaps in networking, DR, and security hardening" | "Solid pipeline, key gaps are network isolation, DR, and security hardening" |

**Key Insight:** GPT-5.2 variants score lower because they evaluate what the architecture *should* have for a healthcare workload, not just what it *does* have. This stricter lens is arguably more useful for production readiness assessment.

---

## Pillar-by-Pillar Comparison

### Reliability

| Finding | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|
| Multi-region DR strategy | ✅ (generic) | ✅ (detailed, per-service) | ✅ (detailed, per-service with RTO/RPO) |
| Availability Zones | ✅ (brief) | ✅ (per-service zones) | ✅ (per-service zones) |
| Backpressure / poison messages | ❌ | ✅ | ✅ |
| Data backup & recovery | ❌ | ✅ (Cosmos continuous + Storage soft delete) | ❌ (covered under DR) |
| Capacity & limits planning | ❌ | ❌ | ✅ (TU/PU/RU/s modeling) |

### Security

| Finding | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|
| Private Endpoints / VNet isolation | ✅ (1 sentence) | ✅ (full private-by-default posture) | ✅ (full private-by-default posture) |
| Managed Identity over keys | ❌ (mentioned reviews only) | ✅ (explicit RBAC migration plan) | ✅ (explicit RBAC migration plan) |
| Customer-Managed Keys (CMK) | ❌ | ✅ (CMK + HSM + purge protection) | ✅ (CMK + encryption governance) |
| Identity governance / PIM | ❌ | ✅ | ❌ (covered under Identity & Secrets) |
| Threat protection / Defender | ❌ | ✅ | ❌ |
| Key Vault hardening | ❌ | ❌ (in operational section) | ✅ (dedicated finding) |
| Messaging security (TLS/SAS) | ❌ | ❌ | ✅ |

### Cost Optimization

| Finding | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|
| Service tier right-sizing | ✅ (generic) | ✅ (Event Hubs + Service Bus specific) | ✅ (all services) |
| VM cost management | ❌ | ✅ (right-size, auto-shutdown, RI) | ❌ |
| Storage lifecycle policies | ❌ | ✅ (hot→cool→archive) | ✅ (hot→cool→archive + compression) |
| Log Analytics cost control | ✅ (brief) | ✅ (DCRs, budgets) | ✅ (sampling, table retention, archive) |
| Reserved capacity / Savings Plans | ❌ | ❌ | ✅ |

### Operational Excellence

| Finding | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|
| SLO-driven alerting | ❌ | ✅ (SLOs + runbooks) | ✅ (SRE-style SLOs + dashboards) |
| Infrastructure as Code | ❌ (mentioned "automation") | ✅ (Bicep/Terraform + Azure Policy) | ✅ (Bicep/Terraform + CI/CD + policy-as-code) |
| Change/release management | ❌ | ✅ (versioned contracts, canary) | ✅ (versioned schemas, canary/slot) |
| Secret/cert lifecycle | ❌ | ✅ (rotation, break-glass) | ✅ (rotation, expiration alerts, access reviews) |

### Performance Efficiency

| Finding | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|
| Throughput / partitioning design | ❌ | ✅ (detailed) | ✅ (Event Hubs → Service Bus justified?) |
| Claim-check pattern for large payloads | ❌ | ✅ | ❌ (mentioned in streaming design) |
| DNS planning for Private Endpoints | ❌ | ✅ | ❌ |
| Cosmos DB data modeling | ❌ | ❌ | ✅ (partition key, indexing tuning) |
| Cold start / pre-warming | ❌ | ❌ | ✅ (Premium pre-warmed instances) |
| Caching strategies | ✅ | ❌ | ❌ |
| VM workload sizing | ❌ | ❌ | ✅ (GPU, disk, VMSS) |

---

## Unique Insights by Model

### GPT-4.1 Only
- **Caching recommendation** — suggested in-memory/distributed caching for Cosmos DB reads (not mentioned by GPT-5.2 variants)

### GPT-5.2 Low Only
- **Claim-check pattern** — route large imaging payloads directly to Storage, pass only URIs through messaging
- **DNS planning** — Private DNS zone linking strategy to avoid resolution failures
- **Threat protection** — Microsoft Defender for Cloud plans for Storage, Cosmos DB, Key Vault
- **Identity governance** — PIM, Conditional Access, Access Reviews
- **Key Vault break-glass procedures** — documented operator fallback for Key Vault outages

### GPT-5.2 Medium Only
- **Capacity & limits planning** — explicit throughput modeling (Event Hubs TU/PU, Service Bus messaging units, Cosmos RU/s)
- **Reserved capacity / Savings Plans** — commitment-based cost optimization
- **Messaging security** — TLS 1.2+ enforcement, SAS vs RBAC authorization
- **Event streaming architecture justification** — questioned whether Event Hubs → Service Bus chaining is needed
- **Cosmos DB data modeling** — partition key strategy, index tuning, bulk execution
- **Cold start mitigation** — Functions Premium with pre-warmed instances
- **VM workload clarity** — GPU sizing, disk throughput, VMSS recommendation

---

## Recommendation Depth

| Aspect | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|---|---|---|
| **Avg. recommendation length** | 1–2 sentences | Full paragraph (4–6 sentences) | Full paragraph (4–6 sentences) |
| **Specificity** | Generic Azure guidance | Named Azure features & SKUs | Named Azure features, SKUs, & patterns |
| **Actionability** | "Enable geo-redundancy" | "Use paired-region strategy; enable Cosmos DB multi-region with automatic failover, Storage GRS/GZRS with tested failover procedures..." | "Define RTO/RPO and implement a two-region DR plan: (1) Cosmos DB multi-region writes... (2) Storage RA-GZRS... (3) Service Bus Premium Geo-DR alias..." |
| **Healthcare awareness** | Not mentioned | References compliance, clinical/legal retention | References HIPAA/HITRUST, immutability (WORM), CMK for healthcare data |

---

## Quick Wins Comparison

| Quick Win Category | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|
| Private endpoints rollout | ✅ | ✅ | ✅ |
| Key Vault hardening | ❌ | ✅ | ✅ |
| Remove key-based access / managed identity | ❌ | ✅ | ❌ |
| Core alerting setup | ✅ | ✅ | ✅ |
| DLQ / message resilience | ❌ | ✅ | ✅ |
| Functions plan optimization | ✅ | ❌ | ❌ |
| Log Analytics cost control | ❌ | ✅ | ✅ |
| **Total** | **3** | **6** | **5** |

---

## Consistency & Variance

GPT-4.1 was run **twice** on the same diagram in the same session. Results:

| Pillar | Run 1 | Run 2 | Delta |
|---|:---:|:---:|:---:|
| Reliability | 72 | 72 | 0 |
| Security | 85 | 85 | 0 |
| Cost Optimization | 74 | 74 | 0 |
| Operational Excellence | 78 | 78 | 0 |
| Performance Efficiency | 80 | 80 | 0 |
| **Overall** | **78** | **78** | **0** |

GPT-4.1 showed **perfect consistency** between runs on identical input. GPT-5.2 variants were each run once; multi-run variance was not tested.

---

## Conclusions

### 1. Depth vs. Speed Tradeoff
GPT-4.1 produces a concise, readable report with ~10 findings. GPT-5.2 variants produce 2× more findings with significantly more actionable detail. For **production readiness reviews**, the extra depth justifies the additional reasoning time.

### 2. GPT-5.2 Low vs. Medium
Both GPT-5.2 variants are substantially deeper than GPT-4.1, but they emphasize different areas:
- **GPT-5.2 Low** excels at **security depth** — identity governance, threat protection, claim-check patterns, break-glass procedures
- **GPT-5.2 Medium** excels at **architectural rigor** — capacity planning, data modeling, cold start mitigation, event streaming justification, numbered DR action plans

### 3. Scoring Accuracy
GPT-5.2's lower scores (72–74) are arguably **more realistic** for an architecture that lacks private endpoints, DR strategy, and CMK — features that are non-negotiable for healthcare workloads. GPT-4.1's 78 may give false confidence.

### 4. Healthcare Awareness
Only GPT-5.2 variants explicitly reference healthcare compliance requirements (HIPAA/HITRUST, WORM immutability, clinical retention). GPT-4.1 treats the architecture as a generic event pipeline.

### 5. Recommendation
| Use Case | Best Model |
|---|---|
| Quick sanity check | GPT-4.1 |
| Pre-production security review | GPT-5.2 Low |
| Full architectural assessment | GPT-5.2 Medium |
| Presentation to stakeholders | GPT-5.2 Medium (structured, numbered action items) |

---

## Test Artifacts

| Model | Report File | Score |
|---|---|:---:|
| GPT-4.1 | `architecture-validation-1770932531248-gpt41.md` | 78/100 |
| GPT-5.2 Low | `architecture-validation-1770932855483-gpt52-low.md` | 72/100 |
| GPT-5.2 Medium | `architecture-validation-1770933301541-gpt52-medium.md` | 74/100 |

Diagram screenshots saved alongside each report as `-diagram.png` files.

---

*Report generated: 2026-02-12*  
*Azure Architecture Diagram Builder — Model Comparison Series*
