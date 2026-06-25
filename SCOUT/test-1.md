Here's your Azure AI / RAG application architecture:

![Azure AI/RAG Architecture](file:///Users/arturoquiroga/Documents/Microsoft%20Scout/ai-rag-architecture.svg)

## What's in the diagram

| Tier | Services | Role |
|------|----------|------|
| **Edge / Client** | User Browser → Azure Front Door | Global entry, WAF, TLS termination |
| **Application** | App Service (chat UI), Container Apps (RAG orchestrator) | Frontend + prompt/retrieval orchestration |
| **AI & Retrieval** | Azure OpenAI, Azure AI Search, Document Intelligence | Embeddings/chat, hybrid+vector retrieval, doc parsing/chunking |
| **Data & Storage** | Blob Storage, Cosmos DB | Source knowledge base + chat history |
| **Security & Ops** | Entra ID, Key Vault, Azure Monitor | Auth/managed identity, secrets, observability |

**RAG flow:** Documents land in Blob → Document Intelligence parses/chunks → indexed into AI Search. At query time, the Orchestrator retrieves relevant chunks from AI Search and calls Azure OpenAI to generate a grounded answer, persisting history to Cosmos DB.

Want me to take this further? I can:
- **Validate** it against the Well-Architected Framework (get a 0–100 score + recommendations)
- **Estimate monthly costs**
- Export an **interactive HTML** version or a **React Flow scene** / **IaC manifest** (Bicep)



| Pillar | Sev | Issue | Recommendation |
| --- | --- | --- | --- |
| Security | 🔴 Critical | App Service not enforcing HTTPS-only | Enable "HTTPS Only", set min TLS 1.2 |
| Security | 🟠 High | Using connection strings instead of managed identity | Enable managed identity for Key Vault, Storage, Cosmos, etc. |
| Reliability | 🟠 High | Cosmos DB single instance, no geo-redundancy | Enable geo-replication / multi-region writes |
| Reliability | 🟠 High | Key Vault lacks soft-delete & purge protection | Enable soft-delete (90-day) + purge protection |
| Reliability | 🟡 Med | No backup / DR detected | Configure point-in-time restore; define RPO/RTO |
| Reliability | 🟡 Med | App Service has no health check endpoint | Configure Health Check to evict unhealthy instances |
| Perf Efficiency | 🟡 Med | No caching layer between compute & data | Add Azure Cache for Redis / CDN |
| Perf Efficiency | 🟡 Med | App Service missing autoscale rules | Autoscale on CPU/memory/HTTP queue |
| Ops Excellence | 🟡 Med | No deployment slots | Use staging slots + swap for zero-downtime deploys |



Here's the hardened architecture. **Score climbed 52 → 65** (+13), and all 3 architecture-level patterns (`single-database`, `no-cache`, `no-backup`) are now cleared.

![Hardened Azure AI/RAG Architecture](file:///Users/arturoquiroga/Documents/Microsoft%20Scout/ai-rag-architecture-hardened.svg)

### What changed
| Added | Fixes |
|-------|-------|
| **Azure Cache for Redis** | ✅ Caching finding (Performance) |
| **Azure Backup** + geo-replicated Cosmos | ✅ DR/backup + single-database (Reliability) |
| Managed-identity edges to Entra ID | Documents identity-based auth intent |

### Score movement
| | Before | After |
|---|---|---|
| **Score** | 52 | **65** |
| Findings | 9 | 6 |
| Patterns detected | 3 | **0** |
| 🔴 Critical | 1 | 1 |
| 🟠 High | 3 | 2 |
| 🟡 Medium | 5 | 3 |

### The 6 remaining findings — all App Service / Key Vault *configuration*, not topology
These can't be "drawn away" — they're runtime settings the validator can't infer from a diagram. You resolve them in IaC/portal config:

1. 🔴 **HTTPS-only + TLS 1.2** on App Service → `httpsOnly: true`, `minTlsVersion: '1.2'`
2. 🟠 **Managed identity** on App Service → enable system-assigned identity
3. 🟠 **Key Vault soft-delete + purge protection** → `enableSoftDelete`, `enablePurgeProtection`
4. 🟡 **App Service health check** → set health check path
5. 🟡 **Deployment slots** → add staging slot + swap
6. 🟡 **Autoscale rules** → scale on CPU/HTTP queue

These six are baked into the App Service / Key Vault resource definitions, so the natural next step is to **export a Bicep IaC manifest** where I set those properties correctly out of the gate — pushing the *effective* posture well above 65. Want me to generate the Bicep manifest, and/or **estimate monthly costs** for this hardened design?


## Monthly Cost Estimate — Hardened Design (region: East US 2)

| Service | Category | Catalog range / unit |
|---------|----------|----------------------|
| Azure Front Door (Std) | Networking | $35–412/mo + traffic |
| App Service (Premium) | App | $13–730/mo |
| Container Apps | Containers | $0–500/mo |
| Azure Cache for Redis | App | ⚠️ no catalog data (~$55–250/mo typical, Std C1–C3) |
| Azure OpenAI | AI/ML | $1–200/mo* |
| Azure AI Search | AI/ML | ⚠️ no catalog data (~$75–250/mo, Standard S1) |
| Document Intelligence | AI/ML | $0–500/mo |
| Blob Storage | Storage | $0.02–184/mo per GB |
| Cosmos DB | Database | $24–29,185/mo |
| Azure Backup | Mgmt | $5–25/mo per instance |
| Key Vault | Security | $0.03 / 10K ops |
| Entra ID | Identity | $0–9/mo per user |
| Azure Monitor | Monitor | $2.30 / GB ingested |

### Realistic "typical production" monthly total
Picking sensible mid-tier configs for a moderate-traffic RAG app:

| Bucket | Est. / mo |
|--------|-----------|
| Compute (App Service P1v3 + Container Apps) | ~$200 |
| Front Door Standard | ~$40 + traffic |
| Redis (Standard C1) | ~$55 |
| AI Search (Standard S1) | ~$245 |
| Azure OpenAI (GPT-4o, moderate tokens) | ~$300–1,500 |
| Document Intelligence (light batch) | ~$50 |
| Cosmos DB (autoscale, single region+geo) | ~$100–400 |
| Blob (100 GB) + Backup + Key Vault + Monitor | ~$60 |
| **Estimated total** | **≈ $1,050 – $2,600 / mo** |

### Key caveats
- **\*Azure OpenAI is the wildcard.** The catalog's $1–200 is way low for real usage — token cost scales with traffic and is usually the **largest line item**. At high volume, consider **Provisioned Throughput Units (PTUs)** for predictable billing.
- **Cosmos DB** range is enormous ($24 → $29K) — driven entirely by provisioned RU/s. Use **autoscale** or **serverless** to stay near the low end for a chat-history workload.
- **Redis & AI Search** lack catalog pricing; figures above are typical list prices.
- Excludes egress/traffic, reserved-instance discounts (1–3yr RIs cut compute 30–60%), and dev/test pricing.

### Biggest cost levers
1. **Azure OpenAI tokens** → cache responses in Redis (already added), trim context, right-size model.
2. **Cosmos RU/s** → serverless or autoscale.
3. **Reserved Instances / savings plans** on App Service + Cosmos for steady workloads.

Want me to **export a Bicep IaC manifest** for this hardened design (with the 6 config-level WAF fixes pre-set), or generate a **React Flow scene** you can import into the Diagram Builder?