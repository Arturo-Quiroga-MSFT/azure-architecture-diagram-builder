# ARM Template Parsing — Model Comparison

## Input

> ARM Template: `template (6).json` — A complex Azure AI/ML production environment with ~140+ resources including Azure Machine Learning hubs/projects, Azure OpenAI (multi-region), Cognitive Services, Container Registries, Key Vaults, Storage Accounts, Event Grid, Application Insights, Log Analytics, Managed Identities, and Smart Detection Alert Rules.

### Bonus Round: GPT-4.1 as Edge Label Enhancer

After GPT-5.2 (Low) generated the initial diagram with orthogonal edges, the diagram was fed back into the app with the prompt **"add more descriptive labels to the edges of this architecture"** using GPT-4.1. This produced a 4th variant with significantly richer edge annotations, pricing data, improved icons, and a 10-step workflow — demonstrating effective **multi-model collaboration**.

---

## Summary Table

| Metric | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Low + GPT-4.1 Labels |
|---|---|---|---|---|
| **Azure Services** | 24 | 18 | 22 | 22 |
| **Groups** | 10 | 5 | 5 | 5 |
| **Connections** | 26 | 25 | 21 | 21 |
| **Self-Loop Edges** | 2 | 0 | 0 | 0 |
| **Async Connections** | 4 | 2 | 6 | 2 |
| **Optional Connections** | 2 | 3 | 0 | 0 |
| **Reverse Connections** | 0 | 0 | 0 | 1 |
| **Workflow Steps** | 0 | 0 | 0 | 10 |
| **Orthogonal Edges** | No | No | Yes | Yes |
| **Pricing Data** | No | No | No | Yes |
| **Avg Label Length** | ~16 chars | ~18 chars | ~32 chars | ~65 chars |

---

## Saved Diagram Files

| Model Config | File |
|---|---|
| GPT-4.1 Mini | `azure-diagram-1770928565655-gpt41mini-from-ARM-template.json` |
| GPT-4.1 | `azure-diagram-1770928772665-gpt41-from-ARM-template.json` |
| GPT-5.2 Low | `azure-diagram-1770929209267-gpt52-low-from-ARM-template.json` |
| GPT-5.2 Low + ortho | `azure-diagram-1770929326062-gpt52-low-from-ARM-template-orthogonal-lines.json` |
| GPT-5.2 Low + GPT-4.1 labels | `azure-diagram-1770929689367-gpt52-low-from-ARM-template-orthogonal-lines-gpt41-added-labels.json` |

---

## Services Comparison Matrix

| Azure Service | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | +GPT-4.1 Labels |
|---|:---:|:---:|:---:|:---:|
| **Azure OpenAI / Cognitive Services** (r2d2-foundry-001) | ✅ | ✅ | ✅ | ✅ |
| **Azure OpenAI** (r2d2-hosted-agents) | ✅ | ✅ | ✅ | ✅ |
| **Azure OpenAI** (r2d2-sweden-central) | ✅ | ✅ | ✅ | ✅ |
| **Document Intelligence** (AQ-DOC-INTEL) | ✅ | ✅ | ✅ | ✅ |
| **Azure ML Hub** (aq-main-hub) | ✅ | ✅ | ✅ | ✅ |
| **Azure ML Project** (aq-hub-project) | ✅ | ✅ | ✅ | ✅ |
| **Azure ML Workspace** (AQ-ML-WORK-001) | ✅ | ✅ | ✅ | ✅ |
| **Container Registry** (ad520cd…) | ✅ | ✅ | ✅ | ✅ |
| **Container Registry** (7a28b21…) | ✅ | ✅ | ✅ | ✅ |
| **Container Registry** (aqr2d2acr001) | ✅ | ✅ | ✅ | ✅ |
| **Key Vault** (kv-aqmainhu…) | ✅ | ✅ | ✅ | ✅ |
| **Key Vault** (aqmlwork…) | ✅ | ✅ | ✅ | ✅ |
| **Storage Account** (aqmlwork…) | ✅ | ✅ | ✅ | ✅ |
| **Storage Account** (staqmainhub…) | ✅ | ✅ | ✅ | ✅ |
| **Application Insights** (aq-app-insights-001) | ✅ | ✅ | ✅ | ✅ |
| **Application Insights** (aqmlwork…) | ✅ | ✅ | ✅ | ✅ |
| **Smart Detection Action Group** | ✅ | ✅ | ✅ | ✅ |
| **Log Analytics** (aqmlwork…) | ✅ | ✅ | ✅ | ✅ |
| **Cognitive Search** (aq-mysearch001) | ✅ | ✅ | ✅ | ✅ |
| **Event Grid System Topic** (aqmlwork storage) | ✅ | — | ✅ | ✅ |
| **Event Grid System Topic** (staqmainhub storage) | ✅ | — | ✅ | ✅ |
| **Managed Identity** (diagnosticexpert-rmxsua…) | ✅ | — | ✅ | ✅ |
| **Managed Identity** (diagnosticexpert2-7aszq…) | ✅ | — | ✅ | ✅ |
| **Managed Identity** (diagnosticexpert-vqay7h…) | ✅ | — | ✅ | ✅ |

---

## Group Organization

| Group | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low |
|---|---|---|---|
| **AI/Cognitive Services** | ✅ "AI Services (Azure Cognitive Services)" — 4 services | ✅ "AI/Cognitive Services" — 4 services | ✅ "AI Services" — 4 services |
| **ML Workspaces/Platform** | ✅ "Machine Learning Workspaces & Components" — 3 services | ✅ "AI Data / ML Hub" (5 svc) + "ML Workspaces" (4 svc) | ✅ "ML Platform" — 6 services |
| **Monitoring** | ✅ "Monitoring & Alerts" — 3 services | ✅ "Monitoring / Observability" — 4 services | ✅ "Monitoring & Alerts" — 4 services |
| **Storage** | ✅ "Storage Accounts" — 2 services | (within ML groups) | ✅ "Storage & Data" — 5 services |
| **Key Vault / Identity** | ✅ "Secrets & Key Management" (2) + "Identity" (3) | (within ML groups) | ✅ "Identity & Secrets" — 5 services |
| **Search** | ✅ "Search Services" — 1 service | ✅ "Search & Analytics" — 1 service | (within Storage & Data) |
| **Event Grid** | ✅ "Event Grid Topics & Subscriptions" — 2 services | — | (within Storage & Data) |
| **Log Analytics** | ✅ "Operational Insights" — 1 service | (within Monitoring) | (within Monitoring) |
| **Total Groups** | **10** | **5** | **5** |

---

## Connection Quality: Edge Label Comparison

A standout difference across models is edge label descriptiveness. Here are the same logical connections compared side by side:

### ML Workspace → Storage Account

| Model | Edge Label |
|---|---|
| GPT-4.1 Mini | "Uses Storage Account" |
| GPT-4.1 | "ML Data, Results" |
| GPT-5.2 Low | "workspace storage (artifacts/blobstore/filestore)" |
| +GPT-4.1 Labels | "Store and retrieve ML workspace artifacts, blobs, and models" |

### ML Workspace → Key Vault

| Model | Edge Label |
|---|---|
| GPT-4.1 Mini | "Uses Key Vault" |
| GPT-4.1 | "Secret Store" |
| GPT-5.2 Low | "secrets & keys" |
| +GPT-4.1 Labels | "Access secured secrets, API keys, and credentials required for ML jobs" |

### ML Hub → Container Registry

| Model | Edge Label |
|---|---|
| GPT-4.1 Mini | "Uses Container Registry" |
| GPT-4.1 | "Uses ACR for images" |
| GPT-5.2 Low | "pull/build images" |
| +GPT-4.1 Labels | "Retrieve/publish container images to central registry for ML workloads" |

### AI Service → App Insights

| Model | Edge Label |
|---|---|
| GPT-4.1 Mini | "App Insights Connection" |
| GPT-4.1 | "App Monitoring (telemetry/metrics)" |
| GPT-5.2 Low | "telemetry/monitoring connection" |
| +GPT-4.1 Labels | "Send telemetry, usage, and performance events for AI endpoint monitoring" |

### AI Service → Search

| Model | Edge Label |
|---|---|
| GPT-4.1 Mini | "Cognitive Search Connection" |
| GPT-4.1 | "Cognitive Search Grounding" |
| GPT-5.2 Low | "retrieval/grounding (AI Search connection)" |
| +GPT-4.1 Labels | "Invoke search index retrieval for grounding LLM responses and enabling RAG" |

### Event Grid → Storage

| Model | Edge Label |
|---|---|
| GPT-4.1 Mini | "Monitors Storage Account events" |
| GPT-4.1 | (not modeled) |
| GPT-5.2 Low | "storage event source (BlobCreated/BlobRenamed)" |
| +GPT-4.1 Labels | "Trigger event actions on BlobCreated/BlobRenamed for downstream ML pipelines" |

---

## Architectural Approach Differences

### GPT-4.1 Mini
- **Over-segmented grouping**: Created 10 groups for 24 services — many groups contain only 1–2 items (Search Services with 1 node, Log Analytics with 1 node). This creates visual clutter.
- **Self-loop edges**: 2 edges (`edge-0`, `edge-1`) loop a node to itself labeled "CapHosts" — an attempt to represent ARM `deployments/capabilityHosts` that doesn't translate well to a diagram.
- **Generic edge labels**: Most labels are functional but generic ("Uses Key Vault", "Uses Storage Account").
- **Best at service discovery**: Captured all 24 distinct services including Event Grid topics and Managed Identities.

### GPT-4.1
- **Clean hub-spoke design**: Used 5 groups with a clear dual-cluster layout — one "AI Data/ML Hub" group at top containing the main hub workspace with its dependencies, and a separate "ML Workspaces" group for the independent AQ-ML-WORK-001 workspace.
- **Skipped Event Grid and Managed Identities**: Focused on core compute/data/monitoring relationships, dropping infrastructure plumbing services. Only 18 of 24 services represented.
- **Contextual edge labels**: More meaningful than Mini — "Primary ML Datastore", "Shares Secret Store", "Delegated/Agents Sharing", "Regional Replica", "Cognitive Search Grounding".
- **Optional connections properly used**: Correctly marked telemetry, agent sharing, and regional replication as optional (dashed, 0.6 opacity).
- **Bidirectional search**: Created both `r2d2-foundry → search` ("Cognitive Search Grounding") and `search → r2d2-foundry` ("Index as grounding data") to show the RAG retrieval loop.

### GPT-5.2 Low
- **Most technically precise labels**: Edge labels include ARM-level detail — "workspace storage (artifacts/blobstore/filestore)", "storage event source (BlobCreated/BlobRenamed)", "associated workspace (Hub resource)".
- **Comprehensive service coverage**: Captured 22 services including Event Grid, Managed Identities, and all container registries.
- **Well-structured 5-group layout**: Clean separation into ML Platform, Identity & Secrets, Storage & Data, AI Services, and Monitoring & Alerts.
- **Properly classified async edges**: Correctly identified 6 async connections (Application Insights telemetry, Event Grid events, Smart Detection alerts).

### GPT-5.2 Low + GPT-4.1 Labels (Multi-Model Collaboration)
- **Dramatically richer labels**: Average label length jumped from ~32 chars to ~65 chars. Labels now read as complete sentences explaining *why* the connection exists, not just *what* it connects.
- **Added pricing data**: GPT-4.1 enriched every node with pricing estimates (e.g., Storage Account $14.60/mo Hot LRS, Azure OpenAI $200/mo Standard).
- **Improved icon paths**: GPT-4.1 upgraded icons — e.g., Cognitive Services → `azure-openai.svg`, Document Intelligence → `document-intelligence.svg`, Managed Identities → `key-vault.svg`.
- **Added 10-step workflow**: Created a structured `workflow` array documenting the end-to-end flow from "User initiates ML experiment" through storage events, LLM inference, RAG grounding, to anomaly detection.
- **Orthogonal edge paths preserved**: All edges retained `pathStyle: "orthogonal"` from the base GPT-5.2 diagram.
- **Icon accuracy trade-off**: While improving AI service icons, Managed Identity icons were incorrectly changed to Key Vault icons, and Event Grid system topics were mis-labeled as "Storage Account".

---

## Key Takeaways

1. **ARM template parsing is harder than prompt-based generation** — the models must reverse-engineer resource relationships from ARM `dependsOn`, connection strings, and nested `Microsoft.MachineLearningServices/workspaces/connections` resources rather than designing from scratch.

2. **GPT-4.1 Mini finds the most resources but over-segments** — 10 groups for 24 services creates a noisy diagram. The self-loop edges ("CapHosts") show it struggled to interpret `capabilityHosts` deployments.

3. **GPT-4.1 produces the cleanest architecture** — 5 groups, clear hub-spoke layout, meaningful edge labels, and proper use of optional/async connection types. Missing Event Grid and Managed Identities is forgivable for readability.

4. **GPT-5.2 Low balances completeness with precision** — 22 services in 5 well-organized groups with technically accurate ARM-level edge labels. Best single-pass output for documentation purposes.

5. **Multi-model collaboration is the winner** — Feeding GPT-5.2's structurally sound diagram back through GPT-4.1 for label enrichment produced the most informative result: sentence-length edge descriptions, pricing data, a 10-step workflow, and improved (mostly) icon paths. This "structure + polish" pipeline is a valuable pattern.

6. **Label quality spectrum**: `Uses Storage Account` → `ML Data, Results` → `workspace storage (artifacts/blobstore/filestore)` → `Store and retrieve ML workspace artifacts, blobs, and models`. Each model adds more context, with the GPT-4.1 label pass delivering full explanatory sentences.

7. **All models correctly identified the Hub ↔ Project workspace pattern** — the Azure ML hub-and-spoke architecture was properly represented with hub→project associations and shared Key Vault/Storage/ACR dependencies across all outputs.
