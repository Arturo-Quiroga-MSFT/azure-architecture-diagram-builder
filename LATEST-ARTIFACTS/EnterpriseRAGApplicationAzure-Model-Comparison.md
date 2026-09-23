# Model Comparison Report

**Generated:** 2026-05-26T20:16:02.066Z

**Prompt:** An enterprise RAG application with Azure AI Foundry for orchestration, Azure AI Search with hybrid vector and keyword retrieval, Azure OpenAI GPT-5 for generation, Azure Cache for Redis for semantic caching, and App Service with Entra ID authentication

**Reasoning Effort:** low

**Models Compared:** 8 successful

## Summary

| Model | Time | Tokens | Services | Connections | Groups | Workflow Steps |
|-------|------|--------|----------|-------------|--------|----------------|
| **GPT-5.1** 📦 Most Services | 27.5s | 4,388 | 10 | 10 | 5 | 10 |
| **GPT-5.2** 🏆 Most Thorough 📦 Most Services 🔗 Most Detailed | 30.9s | 3,994 | 10 | 13 | 5 | 8 |
| **GPT-5.2 Codex** | 22.4s | 3,271 | 8 | 12 | 5 | 6 |
| **GPT-5.3 Codex** | 26.6s | 3,748 | 8 | 12 | 5 | 7 |
| **GPT-5.4** | 32.9s | 3,897 | 9 | 12 | 5 | 8 |
| **GPT-5.4 Mini** ⚡ Fastest | 15.4s | 3,890 | 8 | 8 | 4 | 8 |
| **DeepSeek V3.2 Speciale** 📦 Most Services | 16.1s | 3,089 | 10 | 12 | 5 | 8 |
| **Grok 4.1 Fast** 💰 Cheapest | 16.0s | 2,751 | 8 | 11 | 5 | 8 |

## Token Usage

| Model | Prompt Tokens | Completion Tokens | Total |
|-------|--------------|-------------------|-------|
| GPT-5.1 | 1,442 | 2,946 | 4,388 |
| GPT-5.2 | 1,442 | 2,552 | 3,994 |
| GPT-5.2 Codex | 1,442 | 1,829 | 3,271 |
| GPT-5.3 Codex | 1,442 | 2,306 | 3,748 |
| GPT-5.4 | 1,442 | 2,455 | 3,897 |
| GPT-5.4 Mini | 1,442 | 2,448 | 3,890 |
| DeepSeek V3.2 Speciale | 1,468 | 1,621 | 3,089 |
| Grok 4.1 Fast | 1,413 | 1,338 | 2,751 |

## Architecture Details

### GPT-5.1

**Services:**

| Service | Type | Group |
|---------|------|-------|
| App Service | App Service | grp-ingress |
| Azure AI Foundry | Azure AI Foundry | grp-ai |
| Azure OpenAI | Azure OpenAI | grp-ai |
| Azure Cognitive Search | Azure Cognitive Search | grp-ai |
| Azure Cache for Redis | Azure Cache for Redis | grp-data |
| Storage Account | Storage Account | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Key Vault | Key Vault | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Client & Application, AI Orchestration & Generation, Data & Caching, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| app-service | entra-id | Redirect user to Microsoft Entra ID for OAuth2/OpenID Connect sign-in | sync |
| app-service | key-vault | Retrieve Azure OpenAI, Azure AI Foundry, and Redis credentials securely | sync |
| app-service | ai-foundry | Send authenticated RAG orchestration request with user query and context | sync |
| ai-foundry | redis-cache | Check and update semantic cache for similar queries and responses | sync |
| ai-foundry | cognitive-search | Execute hybrid vector and keyword search for relevant documents | sync |
| cognitive-search | storage-account | Access indexed documents and vectorized content from storage | sync |
| ai-foundry | azure-openai | Call GPT-5 chat completion with augmented prompt and retrieved context | sync |
| ai-foundry | app-service | Return final RAG answer and reasoning metadata to web application | sync |
| app-service | azure-monitor | Emit application telemetry, request traces, and dependency metrics | sync |
| azure-monitor | log-analytics | Ingest logs and metrics into Log Analytics workspace for analysis | sync |

**Workflow:**

1. User accesses the RAG web application, which initiates sign-in via Microsoft Entra ID. _(app-service, entra-id)_
2. After authentication, the application retrieves required secrets and connection strings from Key Vault. _(app-service, key-vault)_
3. The authenticated client sends a RAG request to the application, which forwards it to Azure AI Foundry for orchestration. _(app-service, ai-foundry)_
4. Azure AI Foundry first checks Azure Cache for Redis for a semantic cache hit for a similar query. _(ai-foundry, redis-cache)_
5. On cache miss, Azure AI Foundry issues a hybrid vector and keyword search to Azure Cognitive Search to find relevant documents. _(ai-foundry, cognitive-search)_
6. Azure Cognitive Search retrieves indexed documents and embeddings from the Storage Account to satisfy the hybrid query. _(cognitive-search, storage-account)_
7. Azure AI Foundry constructs an augmented prompt using retrieved content and calls Azure OpenAI GPT-5 for response generation. _(ai-foundry, azure-openai)_
8. Azure AI Foundry returns the generated answer and any metadata to App Service, optionally updating the semantic cache. _(ai-foundry, app-service, redis-cache)_
9. App Service sends usage, performance, and dependency telemetry to Azure Monitor for centralized observability. _(app-service, azure-monitor)_
10. Azure Monitor forwards collected telemetry to Log Analytics, where it is stored and queried for insights and alerting. _(azure-monitor, log-analytics)_

---

### GPT-5.2

**Services:**

| Service | Type | Group |
|---------|------|-------|
| App Service | App Service | grp-ingress |
| Azure AI Foundry | Azure AI Foundry | grp-app |
| Azure OpenAI | Azure OpenAI | grp-app |
| Azure Cognitive Search | Azure Cognitive Search | grp-data |
| Storage Account | Storage Account | grp-data |
| Azure Cache for Redis | Azure Cache for Redis | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Key Vault | Key Vault | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitoring |
| Log Analytics | Log Analytics | grp-monitoring |

**Groups:** Ingress & Web, Application & Orchestration, Data & Retrieval, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-entra | svc-appservice | Authenticate users and issue tokens for App Service access (OIDC/OAuth2) | sync |
| svc-appservice | svc-keyvault | Retrieve runtime secrets (Search/OpenAI endpoints, keys, and configuration) | sync |
| svc-appservice | svc-redis | Check semantic cache for prior answers and cached retrieval contexts | sync |
| svc-appservice | svc-foundry | Submit RAG orchestration request with user prompt, auth context, and conversation state | sync |
| svc-storage | svc-search | Provide documents/chunks for ingestion and indexing (content source for search index updates) | async |
| svc-foundry | svc-search | Execute hybrid retrieval query (keyword + vector) and request top-K grounded passages | sync |
| svc-search | svc-foundry | Return ranked results with passages, metadata, and relevance scores for grounding | sync |
| svc-foundry | svc-openai | Call GPT-5 with system instructions, user question, and retrieved context to generate grounded response | sync |
| svc-openai | svc-foundry | Return completion with citations-ready content and model output tokens | sync |
| svc-foundry | svc-redis | Write semantic cache entry keyed by normalized intent/context and store final answer with citations | sync |
| svc-foundry | svc-appservice | Return finalized grounded answer, citations, and trace identifiers to the application | sync |
| svc-appservice | svc-monitor | Emit application metrics and request traces (latency, cache hit rate, retrieval/generation timings) | sync |
| svc-monitor | svc-loganalytics | Route collected logs and metrics to Log Analytics workspace for querying and alerting | sync |

**Workflow:**

1. User accesses the RAG application and is authenticated to obtain an access token. _(svc-entra, svc-appservice)_
2. Application loads required secrets and configuration to call downstream AI and retrieval services. _(svc-appservice, svc-keyvault)_
3. Application checks semantic cache to short-circuit repeated questions and reuse previously grounded responses. _(svc-appservice, svc-redis)_
4. On cache miss, application submits a RAG orchestration request to Azure AI Foundry. _(svc-appservice, svc-foundry)_
5. Orchestrator performs hybrid retrieval against AI Search to gather the most relevant grounding passages. _(svc-foundry, svc-search)_
6. Orchestrator calls GPT-5 with retrieved context to generate a grounded answer suitable for citation. _(svc-foundry, svc-openai)_
7. Orchestrator stores the final response and associated context in Redis to improve performance for future similar queries. _(svc-foundry, svc-redis)_
8. Application returns the grounded answer to the user and records operational telemetry for monitoring. _(svc-appservice, svc-monitor, svc-loganalytics)_

---

### GPT-5.2 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| App Service | App Service | grp-ingress |
| Azure AI Foundry | Azure AI Foundry | grp-app |
| Azure OpenAI | Azure OpenAI | grp-app |
| Azure Cache for Redis | Azure Cache for Redis | grp-app |
| Azure Cognitive Search | Azure Cognitive Search | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress / Edge, Application / Orchestration, Data / Retrieval, Identity / Security, Monitoring / Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-appsvc | svc-entra | Validate user sign-in with enterprise identity | sync |
| svc-appsvc | svc-redis | Check semantic cache for existing response | optional |
| svc-appsvc | svc-foundry | Submit grounded generation request | sync |
| svc-foundry | svc-redis | Lookup cached embeddings and prior answers | sync |
| svc-redis | svc-foundry | Return cached retrieval snippets if found | optional |
| svc-foundry | svc-search | Execute hybrid vector + keyword search | sync |
| svc-search | svc-foundry | Return ranked documents and citations | sync |
| svc-foundry | svc-openai | Send grounded prompt for GPT-5 generation | sync |
| svc-openai | svc-foundry | Return generated answer with reasoning | sync |
| svc-foundry | svc-appsvc | Deliver final response payload | sync |
| svc-appsvc | svc-azmon | Emit application metrics and traces | sync |
| svc-azmon | svc-log | Persist telemetry for analysis | sync |

**Workflow:**

1. User accesses the RAG application and is authenticated via enterprise identity _(svc-appsvc, svc-entra)_
2. Application checks the semantic cache to short-circuit common queries _(svc-appsvc, svc-redis)_
3. App submits the request to the AI Foundry orchestrator for RAG execution _(svc-appsvc, svc-foundry)_
4. Foundry performs hybrid retrieval against the search index and collects sources _(svc-foundry, svc-search)_
5. Foundry sends grounded prompt to Azure OpenAI for GPT-5 generation and receives the answer _(svc-foundry, svc-openai)_
6. Foundry returns the final response to the application and telemetry is recorded _(svc-foundry, svc-appsvc, svc-azmon, svc-log)_

---

### GPT-5.3 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| App Service | App Service | grp-ingress |
| Azure AI Foundry | Azure AI Foundry | grp-app |
| Azure OpenAI | Azure OpenAI | grp-app |
| Azure Cognitive Search | Azure Cognitive Search | grp-data |
| Azure Cache for Redis | Azure Cache for Redis | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress & Experience, RAG Orchestration & Generation, Retrieval & Caching, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-entra | svc-appservice | Authenticate enterprise users and issue OAuth/OIDC tokens | sync |
| svc-appservice | svc-aifoundry | Submit user query and conversation context for RAG orchestration | sync |
| svc-aifoundry | svc-redis | Check semantic cache for matching prompt-context signature | sync |
| svc-redis | svc-aifoundry | Return cached grounded answer when similarity threshold is met | optional |
| svc-aifoundry | svc-search | Execute hybrid vector plus keyword retrieval for top-k evidence | sync |
| svc-search | svc-aifoundry | Return ranked passages and metadata for grounding | sync |
| svc-aifoundry | svc-openai | Send grounded prompt to GPT-5 for answer synthesis with citations | sync |
| svc-openai | svc-aifoundry | Return generated completion and citation-ready output | sync |
| svc-aifoundry | svc-redis | Store semantic cache entry for prompt, retrieved chunks, and final response | async |
| svc-aifoundry | svc-appservice | Return final grounded response to client channel | sync |
| svc-appservice | svc-azmonitor | Publish request latency, token usage, and failure telemetry | async |
| svc-azmonitor | svc-loganalytics | Ingest platform logs and metrics for centralized analysis | async |

**Workflow:**

1. User signs in through the application using enterprise identity. _(svc-entra, svc-appservice)_
2. Application forwards authenticated query and context to orchestration. _(svc-appservice, svc-aifoundry)_
3. Orchestration checks semantic cache and optionally serves a cached grounded response. _(svc-aifoundry, svc-redis)_
4. On cache miss or low-confidence hit, orchestration performs hybrid retrieval over enterprise index. _(svc-aifoundry, svc-search)_
5. Retrieved evidence is injected into a grounded prompt for GPT-5 generation. _(svc-aifoundry, svc-openai)_
6. Generated answer is returned to orchestration, stored in semantic cache, and sent back to the app. _(svc-openai, svc-aifoundry, svc-redis)_
7. Application delivers the final response to the user and emits telemetry to centralized monitoring. _(svc-appservice, svc-azmonitor, svc-loganalytics)_

---

### GPT-5.4

**Services:**

| Service | Type | Group |
|---------|------|-------|
| App Service | App Service | grp-app |
| Azure AI Foundry | Azure AI Foundry | grp-ai |
| Azure Cognitive Search | Azure Cognitive Search | grp-ai |
| Azure OpenAI | Azure OpenAI | grp-ai |
| Azure Cache for Redis | Azure Cache for Redis | grp-ai |
| Storage Account | Storage Account | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Application Access, RAG Orchestration, Knowledge Data, Identity, Monitoring

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-entra | svc-appservice | Issue OAuth tokens for employee sign-in and session authorization | sync |
| svc-appservice | svc-redis | Check semantic cache for similar previously answered prompts | sync |
| svc-redis | svc-appservice | Return cached grounded answer when similarity threshold is satisfied | optional |
| svc-appservice | svc-aifoundry | Submit uncached chat request for orchestration and grounding | sync |
| svc-aifoundry | svc-search | Execute hybrid vector and keyword retrieval against enterprise index | sync |
| svc-search | svc-aifoundry | Return ranked passages, metadata, and nearest-neighbor matches | sync |
| svc-aifoundry | svc-openai | Send grounded prompt with retrieved context to GPT-5 for answer generation | sync |
| svc-openai | svc-aifoundry | Return generated answer, citations, and model completion output | sync |
| svc-aifoundry | svc-redis | Store semantic cache entry for prompt fingerprint and final response | async |
| svc-storage | svc-search | Provide source documents for indexing, chunking, and vector enrichment | async |
| svc-appservice | svc-monitor | Emit request latency, dependency calls, and user interaction telemetry | async |
| svc-monitor | svc-loganalytics | Persist aggregated application and platform diagnostics for analysis | async |

**Workflow:**

1. Enterprise content is stored and supplied to the search service to build the hybrid retrieval index. _(svc-storage, svc-search)_
2. A user signs in to the RAG application using enterprise identity and receives an authenticated session. _(svc-entra, svc-appservice)_
3. The application checks the semantic cache to determine whether a similar question already has a reusable grounded answer. _(svc-appservice, svc-redis)_
4. If no cache hit is found, the application submits the user query to Azure AI Foundry for orchestration. _(svc-appservice, svc-aifoundry)_
5. Azure AI Foundry retrieves relevant passages using hybrid vector and keyword search over indexed enterprise knowledge. _(svc-aifoundry, svc-search, svc-storage)_
6. Azure AI Foundry sends the grounded prompt and retrieved context to GPT-5 to generate a response with citations. _(svc-aifoundry, svc-openai)_
7. The orchestrated response is cached for semantic reuse and returned to the authenticated application user. _(svc-aifoundry, svc-redis, svc-appservice)_
8. The application emits telemetry to centralized monitoring where logs and metrics are retained for operations analysis. _(svc-appservice, svc-monitor, svc-loganalytics)_

---

### GPT-5.4 Mini

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Microsoft Entra ID | Microsoft Entra ID | identity |
| App Service | App Service | edge-app |
| Azure AI Foundry | Azure AI Foundry | ai-orchestration |
| Azure Cognitive Search | Azure Cognitive Search | ai-orchestration |
| Azure OpenAI | Azure OpenAI | ai-orchestration |
| Azure Cache for Redis | Azure Cache for Redis | ai-orchestration |
| Storage Account | Storage Account | data-security |
| Log Analytics | Log Analytics | - |

**Groups:** Ingress / Application, AI Orchestration / Retrieval, Data / Storage, Identity / Security

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| entra-id | app-service | Authenticate enterprise users and issue sign-in tokens | sync |
| app-service | ai-foundry | Submit authenticated user prompts to the orchestration layer | sync |
| ai-foundry | redis-cache | Check semantic cache for an existing answer before retrieval | sync |
| ai-foundry | ai-search | Run hybrid vector and keyword retrieval for grounded context | sync |
| ai-search | content-store | Resolve indexed document chunks from the source content repository | sync |
| ai-foundry | openai | Send grounded prompt and retrieved context for GPT-5 generation | sync |
| ai-foundry | redis-cache | Store completed answer for future semantic cache hits | async |
| ai-foundry | log-analytics | Emit orchestration and retrieval telemetry for centralized analysis | async |

**Workflow:**

1. A user signs in through Microsoft Entra ID and reaches the App Service hosted RAG experience. _(entra-id, app-service)_
2. The authenticated user submits a question from App Service to Azure AI Foundry for orchestration. _(app-service, ai-foundry)_
3. Azure AI Foundry checks Azure Cache for Redis to reuse a semantically similar prior answer when available. _(ai-foundry, redis-cache)_
4. On a cache miss, Azure AI Foundry queries Azure Cognitive Search using both vector similarity and keyword filters. _(ai-foundry, ai-search)_
5. Azure Cognitive Search serves the most relevant chunks from the indexed document corpus in Storage Account. _(ai-search, content-store)_
6. Azure AI Foundry composes a grounded prompt from the retrieved context and sends it to Azure OpenAI. _(ai-foundry, openai)_
7. Azure OpenAI generates the final GPT-5 response and returns it to Azure AI Foundry. _(openai, ai-foundry)_
8. Azure AI Foundry writes the completed response to Azure Cache for Redis and returns the answer to App Service. _(ai-foundry, redis-cache, app-service)_

---

### DeepSeek V3.2 Speciale

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Microsoft Entra ID | Microsoft Entra ID | edge |
| App Service | App Service | compute |
| Azure AI Foundry | Azure AI Foundry | compute |
| Azure OpenAI | Azure OpenAI | compute |
| Azure Cognitive Search | Azure Cognitive Search | data |
| Azure Cache for Redis | Azure Cache for Redis | cache |
| Storage Account | Storage Account | data |
| Key Vault | Key Vault | edge |
| Azure Monitor | Azure Monitor | monitoring |
| Log Analytics | Log Analytics | monitoring |

**Groups:** Client & Authentication, Application & AI Orchestration, Data & Search, Caching, Monitoring

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| app-service | entra-id | Authenticates users | sync |
| app-service | ai-foundry | Sends user query to orchestration | sync |
| ai-foundry | redis | Checks cache for similar queries | sync |
| ai-foundry | ai-search | Retrieves relevant documents (hybrid search) | sync |
| ai-search | storage | Accesses indexed documents (blob storage) | sync |
| ai-foundry | openai | Generates answer using GPT-5 | sync |
| ai-foundry | redis | Stores query/response in semantic cache | sync |
| app-service | key-vault | Retrieves secrets and connection strings | sync |
| ai-foundry | key-vault | Retrieves API keys for services | sync |
| app-service | monitor | Sends application metrics and logs | async |
| ai-foundry | monitor | Sends orchestration metrics and logs | async |
| monitor | log-analytics | Forwards logs for analysis | async |

**Workflow:**

1. User authenticates via Entra ID and sends query through App Service frontend. _(app-service, entra-id)_
2. App Service forwards the query to Azure AI Foundry for orchestration. _(app-service, ai-foundry)_
3. AI Foundry checks Azure Cache for Redis for a cached response to a similar query. If found, returns cached answer. _(ai-foundry, redis)_
4. If not cached, AI Foundry uses Azure Cognitive Search to perform hybrid (vector + keyword) retrieval over documents stored in Blob Storage. _(ai-foundry, ai-search, storage)_
5. AI Foundry sends retrieved context and query to Azure OpenAI GPT-5 to generate an answer. _(ai-foundry, openai)_
6. AI Foundry stores the query and generated answer in Redis cache for future semantic caching. _(ai-foundry, redis)_
7. AI Foundry returns the answer to App Service, which presents it to the user. _(ai-foundry, app-service)_
8. Throughout the process, App Service and AI Foundry send telemetry to Azure Monitor, which forwards logs to Log Analytics for monitoring. _(app-service, ai-foundry, monitor, log-analytics)_

---

### Grok 4.1 Fast

**Services:**

| Service | Type | Group |
|---------|------|-------|
| App Service | App Service | edge-auth |
| Microsoft Entra ID | Microsoft Entra ID | edge-auth |
| Azure AI Foundry | Azure AI Foundry | group-ai-foundry |
| Azure Cognitive Search | Azure Cognitive Search | retrieval |
| Azure Cache for Redis | Azure Cache for Redis | retrieval |
| Azure OpenAI | Azure OpenAI | generation |
| Application Insights | Application Insights | observability |
| Log Analytics | Log Analytics | observability |

**Groups:** Edge & Authentication, AI Foundry Orchestration, Retrieval & Caching, AI Generation, Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| app-service | entra-id | Authenticate user sessions | sync |
| app-service | ai-foundry | Submit RAG query request | sync |
| ai-foundry | ai-search | Execute hybrid vector/keyword search | sync |
| ai-foundry | redis-cache | Check semantic cache for existing response | sync |
| redis-cache | ai-foundry | Return cached response if found | sync |
| ai-foundry | openai | Generate response with retrieved context | sync |
| openai | ai-foundry | Return generated response | sync |
| ai-foundry | redis-cache | Cache new semantic response | async |
| ai-foundry | app-service | Return final RAG response | sync |
| app-service | app-insights | Send application telemetry | async |
| app-insights | log-analytics | Forward metrics and traces | async |

**Workflow:**

1. User authenticates via Entra ID and submits query to App Service _(app-service, entra-id)_
2. App Service forwards query to AI Foundry orchestrator _(app-service, ai-foundry)_
3. AI Foundry checks Redis semantic cache for existing response _(ai-foundry, redis-cache)_
4. AI Foundry performs hybrid retrieval via Cognitive Search _(ai-foundry, ai-search)_
5. AI Foundry invokes Azure OpenAI GPT-5 for response generation _(ai-foundry, openai)_
6. Generated response cached in Redis and returned to App Service _(ai-foundry, redis-cache, app-service)_
7. App Service streams final response to authenticated user _(app-service, entra-id)_
8. Application Insights collects telemetry forwarded to Log Analytics _(app-service, app-insights, log-analytics)_

---

