# Black Friday E-Commerce Platform — Model Comparison

## Prompt Used

> A Black Friday-ready e-commerce platform handling 50,000 orders/hour peak with real-time inventory sync across 12 regional warehouses, ML-powered fraud detection scoring each transaction in under 200ms, personalized recommendations engine, multi-currency payment processing with PCI-DSS compliance, abandoned cart recovery workflows, using Azure Kubernetes Service for microservices, Cosmos DB for product catalog with global distribution, Redis Cache for session and cart state, Service Bus for order orchestration, Azure Functions for inventory webhooks, Cognitive Search for faceted product search, and CDN with dynamic site acceleration

---

## Summary Table

| Metric | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|---|---|---|---|
| **Generation Time** | 32 seconds | 19 seconds | 119 seconds | 145 seconds |
| **Azure Services** | 12 | 15 | 18 | 22 |
| **Groups** | 5 | 6 | 5 | 5 |
| **Connections** | 12 | 15 | 22 | 28 |
| **Workflow Steps** | 10 | 10 | 10 | 9 |
| **Async Connections** | 2 | 3 | 6 | 6 |
| **Optional Connections** | 0 | 2 | 0 | 1 |
| **Bidirectional Connections** | 0 | 1 | 1 | 1 |

---

## Saved Diagram Files

| Model Config | File |
|---|---|
| GPT-4.1 Mini (32s) | `azure-diagram-1770920937800-gpt41mini-32-seconds-black-friday.json` |
| GPT-4.1 (19s) | `azure-diagram-1770921705423-gpt41-19-seconds-black-friday.json` |
| GPT-5.2 Low (119s) | `azure-diagram-1770922090629-gpt52-low-119-seconds-black-friday.json` |
| GPT-5.2 Medium (145s) | `azure-diagram-1770922753656-gpt52-medium-145-seconds-black-friday.json` |

---

## Services Comparison Matrix

| Azure Service | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| **Azure Kubernetes Service** | ✅ | ✅ | ✅ | ✅ |
| **Azure Cosmos DB** | ✅ | ✅ | ✅ | ✅ |
| **Azure Cache for Redis** | ✅ | ✅ | ✅ | ✅ |
| **Service Bus** | ✅ | ✅ | ✅ | ✅ |
| **Azure Functions** | ✅ | ✅ | ✅ | ✅ |
| **Azure Cognitive Search** | ✅ | ✅ | ✅ | ✅ |
| **Key Vault** | ✅ | ✅ | ✅ | ✅ |
| **Microsoft Entra ID** | ✅ | ✅ | ✅ | ✅ |
| **Content Delivery Network** | ✅ | ✅ | ✅ | ✅ |
| **Application Gateway** | ✅ | ✅ | — | ✅ |
| **Azure Machine Learning** | ✅ | ✅ | ✅ | ✅ |
| **AML Online Endpoint** | — | ✅ (×2) | ✅ | ✅ |
| **Azure OpenAI** | ✅ | — | — | — |
| **Logic Apps** | — | ✅ | ✅ | ✅ |
| **Azure Static Web Apps** | — | ✅ | — | — |
| **Azure Front Door** | — | — | ✅ | ✅ |
| **API Management** | — | — | ✅ | ✅ |
| **Storage Account** | — | — | ✅ | ✅ |
| **Application Insights** | — | — | ✅ | ✅ |
| **Log Analytics** | — | — | ✅ | ✅ |
| **Microsoft Defender for Cloud** | — | — | ✅ | ✅ |
| **SQL Database** | — | — | — | ✅ |
| **Azure Firewall** | — | — | — | ✅ |
| **Azure Monitor** | — | — | — | ✅ |

---

## Prompt Requirements Coverage

| Requirement | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| 50,000 orders/hour peak | Implicit | Implicit | ✅ Workflow text | ✅ Workflow text |
| Real-time inventory sync (12 warehouses) | ✅ Functions → AKS loop | ✅ Functions bidirectional | ✅ Functions bidirectional | ✅ Functions + Cosmos writes |
| ML fraud detection (<200ms) | ✅ AKS → AML | ✅ Dedicated AML endpoint | ✅ AML Online Endpoint | ✅ AML Online Endpoint |
| Personalized recommendations | ✅ Azure OpenAI | ✅ Dedicated AML endpoint | ✅ AML Online Endpoint | ✅ AML Online Endpoint |
| Multi-currency payment / PCI-DSS | ✅ Key Vault | ✅ Key Vault | ✅ Key Vault | ✅ Key Vault + SQL DB |
| Abandoned cart recovery | ❌ Not modeled | ✅ Logic Apps | ✅ Logic Apps | ✅ Logic Apps → APIM |
| AKS for microservices | ✅ | ✅ | ✅ | ✅ |
| Cosmos DB global distribution | ✅ | ✅ | ✅ | ✅ |
| Redis for session/cart | ✅ | ✅ | ✅ | ✅ |
| Service Bus for order orchestration | ✅ | ✅ | ✅ | ✅ |
| Functions for inventory webhooks | ✅ | ✅ | ✅ | ✅ |
| Cognitive Search faceted | ✅ | ✅ | ✅ | ✅ |
| CDN dynamic site acceleration | ✅ | ✅ CDN + Static Web Apps | ✅ Front Door + CDN | ✅ Front Door + CDN |

---

## Detailed Analysis

### GPT-4.1 Mini — 32 seconds | 12 services | 12 connections

**Strengths:**
- Fastest generation with competent core architecture
- All explicitly-requested services present
- Used Azure OpenAI for recommendations (creative choice, though not requested)
- Clean 10-step workflow covering full user journey

**Weaknesses:**
- **Missing abandoned cart recovery** — a key prompt requirement not addressed at all
- No Logic Apps for workflow orchestration
- No observability layer (no App Insights, Log Analytics, or monitoring)
- No API gateway or Front Door — traffic flows directly from CDN → App Gateway → AKS
- Placed Cognitive Search inside the AI & ML group rather than Data group
- Only sync/async connection types; no optional or bidirectional connections

**Architecture Style:** Simple hub-and-spoke with AKS as the central hub connecting to all other services.

---

### GPT-4.1 — 19 seconds | 15 services | 15 connections

**Strengths:**
- **Fastest generation** of all models at 19 seconds — even faster than Mini
- Properly modeled abandoned cart recovery with Logic Apps triggered by Service Bus
- Separated ML into distinct **fraud detection endpoint** and **recommendations endpoint** (smart design)
- Added Azure Static Web Apps as explicit frontend layer
- Used **optional** connection type for ML model deployment paths (AML → endpoints)
- Bidirectional async connection for Service Bus ↔ Functions
- 6 distinct groups with clear separation of concerns

**Weaknesses:**
- No global load balancer (Front Door) or API Management gateway
- No observability services (App Insights, Log Analytics, monitoring)
- No network security layer (Firewall, NSGs)
- Two AML Online Endpoints with identical labels ("AML Online Endpoint") — could confuse viewers

**Architecture Style:** Well-structured tiered architecture with dedicated frontend, clear ML separation, and proper orchestration — best balance of speed and quality.

---

### GPT-5.2 Low Reasoning — 119 seconds | 18 services | 22 connections

**Strengths:**
- Added **Azure Front Door** for global acceleration and health-based routing
- Added **API Management** as proper API gateway with policies
- Full **observability stack**: Application Insights → Log Analytics, plus Defender for Cloud
- **Storage Account** for static asset origin behind CDN
- Detailed connection labels with technical specifics (e.g., "sub-millisecond latency", "OAuth/OIDC tokens")
- Proper async event flows with Service Bus bidirectional connections
- 10-step workflow with clear narrative progression

**Weaknesses:**
- Missing Application Gateway (Front Door used instead — valid architecture trade-off)
- Single AML Online Endpoint serving both fraud and recommendations (less separation)
- Some connection labels could be more concise for diagram readability

**Architecture Style:** Enterprise-grade with proper API management, edge networking, and security monitoring layers — a production-ready design.

---

### GPT-5.2 Medium Reasoning — 145 seconds | 22 services | 28 connections

**Strengths:**
- **Most comprehensive architecture** with 22 services and 28 connections
- Added **SQL Database** for transactional order data — correctly separates product catalog (Cosmos DB) from order records (SQL)
- **Azure Firewall** for east-west network security — critical for PCI-DSS compliance
- **Azure Monitor** in addition to Application Insights — full observability pipeline
- **Cosmos DB → Cognitive Search** index population flow — no other model captured this
- **Logic Apps → APIM** callback for cart recovery — shows the full loop, not just trigger
- Connection labels are extremely detailed and contextual (e.g., "Persist finalized order records, payment references, and multi-currency totals after fraud approval")
- Best PCI-DSS compliance coverage: Firewall + Key Vault + Defender + Entra ID

**Weaknesses:**
- 145 seconds generation time (7.6× slower than GPT-4.1)
- Some edge offsets suggest manual repositioning needed for clean layout
- Complexity may be overwhelming for initial presentations

**Architecture Style:** Production-grade enterprise architecture with defense-in-depth security, full observability, and proper separation of transactional vs. catalog data stores.

---

## Key Takeaways

### 1. Abandoned Cart Recovery
Only **GPT-4.1 Mini missed** the abandoned cart requirement entirely. GPT-4.1 added Logic Apps, GPT-5.2 models added Logic Apps + detailed event flow. **GPT-5.2 Medium went furthest** by showing Logic Apps calling back into APIM to generate restore links.

### 2. ML Architecture Sophistication
- **GPT-4.1 Mini**: Used Azure OpenAI (not Azure ML) for recommendations — creative but off-pattern
- **GPT-4.1**: Best ML separation with **two dedicated ML endpoints** (fraud + recommendations) backed by a shared ML workspace
- **GPT-5.2 models**: Single AML Online Endpoint for both, with ML workspace for model deployment — simpler but less explicit

### 3. Security & Compliance Depth
| Layer | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|---|---|---|---|
| Identity | Entra ID | Entra ID | Entra ID | Entra ID |
| Secrets | Key Vault | Key Vault | Key Vault | Key Vault |
| Network | App Gateway | — | Front Door | Front Door + App Gateway + Firewall |
| API Gateway | — | — | APIM | APIM |
| Monitoring | — | — | App Insights + Log Analytics | App Insights + Monitor + Log Analytics |
| Threat Detection | — | — | Defender for Cloud | Defender for Cloud |

### 4. Data Architecture Decisions
- **GPT-5.2 Medium uniquely added SQL Database** for order transactions, correctly separating the globally-distributed catalog (Cosmos DB) from ACID-compliant order records
- **GPT-5.2 models added Storage Account** as CDN origin for static assets
- **GPT-5.2 Medium modeled Cosmos DB → Search index refresh** — a real-world pattern missed by all other models

### 5. Speed vs. Depth Trade-off
| Model | Time | Depth Ratio (services/second) |
|---|---|---|
| GPT-4.1 | 19s | 0.79 services/sec |
| GPT-4.1 Mini | 32s | 0.38 services/sec |
| GPT-5.2 Low | 119s | 0.15 services/sec |
| GPT-5.2 Medium | 145s | 0.15 services/sec |

GPT-4.1 delivers the best efficiency — more services per second than any other model. GPT-5.2 models are slower but produce significantly more detailed and complete architectures.

### 6. Connection Quality
GPT-5.2 Medium's connection labels are notably more specific and actionable than other models. Compare:
- **Mini**: "Send order events for processing orchestration"
- **4.1**: "Send new order messages for orchestration"  
- **5.2 Low**: "Publish order-created and payment-authorized events for orchestrated fulfillment"
- **5.2 Medium**: "Publish OrderCreated message for downstream orchestration (payment capture, fulfillment, notifications)"

### 7. Overall Ranking (for this prompt)

| Rank | Model | Rationale |
|---|---|---|
| 🥇 | **GPT-5.2 Medium** | Most complete architecture with SQL separation, firewall, full observability, and recovery loop — best for production reference |
| 🥈 | **GPT-5.2 Low** | Strong enterprise-grade output with API management and monitoring — good balance of depth and cost |
| 🥉 | **GPT-4.1** | Best speed-to-quality ratio with smart ML endpoint separation and abandoned cart coverage — ideal for quick iterations |
| 4th | **GPT-4.1 Mini** | Competent but missed abandoned cart requirement and lacks security/monitoring layers |
