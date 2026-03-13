# Model Comparison Report

**Generated:** 2026-03-12T23:00:12.724Z

**Prompt:** Microservices app with API gateway and auth

**Reasoning Effort:** low

**Models Compared:** 7 successful

## Summary

| Model | Time | Tokens | Services | Connections | Groups | Workflow Steps |
|-------|------|--------|----------|-------------|--------|----------------|
| **GPT-5.1** ⚡ Fastest | 15.8s | 3,690 | 10 | 10 | 5 | 9 |
| **GPT-5.2** | 53.6s | 3,739 | 9 | 12 | 5 | 7 |
| **GPT-5.2 Codex** | 22.0s | 2,891 | 9 | 9 | 5 | 8 |
| **GPT-5.3 Codex** | 41.0s | 4,207 | 10 | 12 | 5 | 8 |
| **GPT-5.4** 📦 Most Services | 41.3s | 3,425 | 11 | 11 | 5 | 7 |
| **DeepSeek V3.2 Speciale** 💰 Cheapest | 35.9s | 2,832 | 10 | 9 | 5 | 8 |
| **Grok 4.1 Fast** 🏆 Most Thorough 📦 Most Services 🔗 Most Detailed | 18.2s | 2,927 | 11 | 13 | 5 | 8 |

## Token Usage

| Model | Prompt Tokens | Completion Tokens | Total |
|-------|--------------|-------------------|-------|
| GPT-5.1 | 1,401 | 2,289 | 3,690 |
| GPT-5.2 | 1,401 | 2,338 | 3,739 |
| GPT-5.2 Codex | 1,401 | 1,490 | 2,891 |
| GPT-5.3 Codex | 1,401 | 2,806 | 4,207 |
| GPT-5.4 | 1,401 | 2,024 | 3,425 |
| DeepSeek V3.2 Speciale | 1,428 | 1,404 | 2,832 |
| Grok 4.1 Fast | 1,374 | 1,553 | 2,927 |

## Architecture Details

### GPT-5.1

**Services:**

| Service | Type | Group |
|---------|------|-------|
| API Management | API Management | grp-ingress |
| Azure Kubernetes Service | Azure Kubernetes Service | grp-app |
| Container Registry | Container Registry | grp-app |
| Azure Cache for Redis | Azure Cache for Redis | grp-data |
| SQL Database | SQL Database | grp-data |
| Storage Account | Storage Account | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Key Vault | Key Vault | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress & API Gateway, Application & Microservices, Data & Caching, Identity & Secrets, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-apim | svc-entra | Validate incoming JWT tokens and enforce OAuth2 scopes for API calls | sync |
| svc-apim | svc-aks | Forward authenticated REST API requests to appropriate microservice endpoints | sync |
| svc-acr | svc-aks | Provide container images for microservices deployments and updates | sync |
| svc-aks | svc-sql | Execute transactional queries and persist microservices domain data | sync |
| svc-aks | svc-redis | Read and write cached session and reference data to reduce database load | sync |
| svc-aks | svc-storage | Store and retrieve files, blobs, and large payloads for business operations | sync |
| svc-aks | svc-keyvault | Retrieve secrets, connection strings, and certificates at runtime | sync |
| svc-aks | svc-azmonitor | Emit metrics, traces, and logs from microservices and platform components | async |
| svc-azmonitor | svc-loganalytics | Ingest collected telemetry into centralized log workspace for analysis | async |
| svc-entra | svc-apim | Issue access tokens used by clients to invoke secured APIs through gateway | sync |

**Workflow:**

1. Client obtains an access token from Microsoft Entra ID and then calls the API endpoint exposed by API Management with the token attached. _(svc-entra, svc-apim)_
2. API Management validates the JWT token and scopes against Microsoft Entra ID and applies API policies such as rate limiting and request transformation. _(svc-apim, svc-entra)_
3. After successful validation, API Management routes the authenticated request to the appropriate microservice running on Azure Kubernetes Service. _(svc-apim, svc-aks)_
4. Azure Kubernetes Service pulls the required container images from Container Registry during deployment or scaling of microservices instances. _(svc-aks, svc-acr)_
5. Microservices running on Azure Kubernetes Service access secrets such as database connection strings and API keys from Key Vault to securely connect to dependent services. _(svc-aks, svc-keyvault)_
6. For read-heavy operations and session management, microservices interact with Azure Cache for Redis to retrieve and update cached data. _(svc-aks, svc-redis)_
7. For transactional operations and core domain persistence, microservices execute queries and commands against SQL Database. _(svc-aks, svc-sql)_
8. When handling large files or binary payloads, microservices store and retrieve data from the Storage Account. _(svc-aks, svc-storage)_
9. Azure Kubernetes Service emits logs, metrics, and traces to Azure Monitor, which then forwards the telemetry into Log Analytics for centralized analysis and alerting. _(svc-aks, svc-azmonitor, svc-loganalytics)_

---

### GPT-5.2

**Services:**

| Service | Type | Group |
|---------|------|-------|
| API Management | API Management | grp-ingress |
| Azure Kubernetes Service | Azure Kubernetes Service | grp-app |
| Container Registry | Container Registry | grp-app |
| Service Bus | Service Bus | grp-app |
| Azure Cosmos DB | Azure Cosmos DB | grp-data |
| Key Vault | Key Vault | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress / API Gateway, Application / Microservices, Data / Storage, Identity / Security, Monitoring / Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-apim | svc-entra | Validate OAuth2/OIDC tokens and enforce API authorization policies | sync |
| svc-apim | svc-aks | Route authenticated API calls to microservice backends | sync |
| svc-apim | svc-kv | Retrieve gateway certificates and named-value secrets at runtime | sync |
| svc-acr | svc-aks | Provide container images for microservice deployments and rollouts | sync |
| svc-aks | svc-cosmos | Read/write operational data for microservice requests | sync |
| svc-aks | svc-sb | Publish commands/events for long-running or decoupled workflows | async |
| svc-sb | svc-aks | Deliver queued messages to background workers and consumers | async |
| svc-apim | svc-sb | Enqueue async work requests when APIs require deferred processing | optional |
| svc-aks | svc-kv | Fetch application secrets/keys using workload identity or managed identity | sync |
| svc-aks | svc-entra | Obtain identity tokens for workload identity and downstream auth flows | sync |
| svc-aks | svc-azmon | Emit platform metrics and application telemetry for centralized monitoring | sync |
| svc-azmon | svc-law | Persist collected logs/metrics into workspace for query, alerting, and retention | sync |

**Workflow:**

1. Client calls the public API endpoint; API gateway initiates authentication and token validation. _(svc-apim, svc-entra)_
2. API gateway enforces policies (rate limits, JWT claims) and forwards the authorized request to the target microservice. _(svc-apim, svc-aks)_
3. Microservice loads runtime secrets (connection strings/keys) using identity-based access and retrieves them from the vault. _(svc-aks, svc-entra, svc-kv)_
4. Microservice processes the request and performs transactional reads/writes to the operational datastore. _(svc-aks, svc-cosmos)_
5. For long-running work, microservice publishes an async message; background consumers pick it up for processing. _(svc-aks, svc-sb)_
6. If an API requires deferred completion, the gateway optionally enqueues a work item and returns an acknowledgement while processing continues asynchronously. _(svc-apim, svc-sb, svc-aks)_
7. Kubernetes emits telemetry to centralized monitoring and logs are retained for queries and alerting. _(svc-aks, svc-azmon, svc-law)_

---

### GPT-5.2 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | grp-ingress |
| API Management | API Management | grp-ingress |
| Azure Kubernetes Service | Azure Kubernetes Service | grp-app |
| Container Registry | Container Registry | grp-app |
| SQL Database | SQL Database | grp-data |
| Azure Cache for Redis | Azure Cache for Redis | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress/Edge, Application/Compute, Data/Storage, Identity/Security, Monitoring/Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| frontdoor | apim | Forward client API requests to gateway | sync |
| apim | entra | Validate access tokens and enforce auth policies | sync |
| apim | aks | Route authorized API calls to microservices | sync |
| aks | sqldb | Read/write transactional service data | sync |
| aks | redis | Cache hot data and session state | sync |
| aks | acr | Pull container images for deployments | sync |
| aks | entra | Acquire service-to-service identity tokens | sync |
| aks | azmon | Send platform metrics and logs | sync |
| azmon | log | Persist telemetry for analysis | sync |

**Workflow:**

1. Client API call enters the global edge and is routed to the gateway _(frontdoor, apim)_
2. Gateway validates the caller identity and policy compliance _(apim, entra)_
3. Authorized requests are routed to the appropriate microservice _(apim, aks)_
4. Microservices read and write transactional data _(aks, sqldb)_
5. Microservices use cache for low-latency access _(aks, redis)_
6. Kubernetes pulls container images for updates and scaling _(aks, acr)_
7. Service identity tokens are obtained for downstream calls _(aks, entra)_
8. Operational telemetry is collected and analyzed _(aks, azmon, log)_

---

### GPT-5.3 Codex

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | grp-edge |
| API Management | API Management | grp-edge |
| Azure Kubernetes Service | Azure Kubernetes Service | grp-app |
| Service Bus | Service Bus | grp-app |
| SQL Database | SQL Database | grp-data |
| Azure Cache for Redis | Azure Cache for Redis | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Key Vault | Key Vault | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitor |
| Log Analytics | Log Analytics | grp-monitor |

**Groups:** Ingress & API Edge, Application & Microservices, Data Layer, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-frontdoor | svc-apim | Forward external HTTPS API traffic to managed gateway endpoints | sync |
| svc-apim | svc-entra | Validate bearer tokens and enforce OAuth2/OpenID Connect policies | sync |
| svc-apim | svc-aks | Route authenticated API operations to target microservice backends | sync |
| svc-apim | svc-servicebus | Enqueue long-running command requests for asynchronous processing | async |
| svc-aks | svc-servicebus | Publish domain events to topics for downstream microservice consumers | async |
| svc-servicebus | svc-aks | Deliver queued commands and subscribed events to worker microservices | async |
| svc-aks | svc-sql | Execute transactional reads and writes for core business entities | sync |
| svc-aks | svc-redis | Read and update cached responses, tokens, and session state | sync |
| svc-aks | svc-keyvault | Retrieve database credentials and service secrets at runtime | sync |
| svc-apim | svc-keyvault | Load TLS certificates and backend authentication secrets for policies | sync |
| svc-aks | svc-azmonitor | Emit application metrics, traces, and health telemetry | sync |
| svc-azmonitor | svc-loganalytics | Ingest and persist consolidated platform and application logs | async |

**Workflow:**

1. Client API calls enter through the global edge and are handed to the managed API gateway. _(svc-frontdoor, svc-apim)_
2. API gateway validates user/application identity tokens against the identity provider. _(svc-apim, svc-entra)_
3. For synchronous operations, gateway forwards authenticated requests to microservices on AKS. _(svc-apim, svc-aks)_
4. For long-running operations, gateway places commands onto messaging queues for deferred processing. _(svc-apim, svc-servicebus)_
5. Microservices publish and consume events/commands through Service Bus to coordinate distributed workflows. _(svc-aks, svc-servicebus)_
6. Microservices persist transactional state in SQL and use Redis for low-latency cache access. _(svc-aks, svc-sql, svc-redis)_
7. Gateway and microservices securely fetch secrets and certificates from Key Vault during execution. _(svc-apim, svc-aks, svc-keyvault)_
8. AKS sends telemetry to Azure Monitor, which streams logs into Log Analytics for operations and troubleshooting. _(svc-aks, svc-azmonitor, svc-loganalytics)_

---

### GPT-5.4

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Azure Front Door | Azure Front Door | grp-edge |
| API Management | API Management | grp-edge |
| Azure Kubernetes Service | Azure Kubernetes Service | grp-app |
| Service Bus | Service Bus | grp-app |
| Azure Functions | Azure Functions | grp-app |
| Azure Cosmos DB | Azure Cosmos DB | grp-data |
| Storage Account | Storage Account | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity |
| Key Vault | Key Vault | grp-identity |
| Azure Monitor | Azure Monitor | grp-monitoring |
| Log Analytics | Log Analytics | grp-monitoring |

**Groups:** Ingress & API, Application & Microservices, Data & Storage, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-frontdoor | svc-apim | Route external API calls to managed API endpoints | sync |
| svc-apim | svc-entra | Validate bearer tokens and enforce authenticated API access | sync |
| svc-apim | svc-aks | Forward authorized API operations to microservice backends | sync |
| svc-aks | svc-servicebus | Publish domain events and queue background work items | async |
| svc-servicebus | svc-functions | Trigger event-driven processing for queued messages | async |
| svc-aks | svc-cosmos | Read and update operational microservice data | sync |
| svc-functions | svc-cosmos | Persist background processing results and status updates | sync |
| svc-aks | svc-storage | Store uploaded content and retrieve shared application files | sync |
| svc-aks | svc-keyvault | Retrieve application secrets and TLS certificates at runtime | sync |
| svc-aks | svc-monitor | Send platform metrics and application telemetry | sync |
| svc-monitor | svc-loganalytics | Export collected telemetry for centralized querying and alert analysis | async |

**Workflow:**

1. Clients enter through the global edge and are routed to the managed API gateway. _(svc-frontdoor, svc-apim)_
2. The API gateway validates user identity and access tokens before allowing the request. _(svc-apim, svc-entra)_
3. Authorized API operations are forwarded to containerized microservices running on Kubernetes. _(svc-apim, svc-aks)_
4. Microservices fetch secrets from the vault and then read or update operational records and files. _(svc-aks, svc-keyvault, svc-cosmos, svc-storage)_
5. When work should be decoupled, microservices publish messages to the queueing layer for asynchronous handling. _(svc-aks, svc-servicebus)_
6. Serverless workers consume queued messages and write processing outcomes back to the operational database. _(svc-servicebus, svc-functions, svc-cosmos)_
7. The primary compute tier emits telemetry to the monitoring service, which centralizes logs for analysis. _(svc-aks, svc-monitor, svc-loganalytics)_

---

### DeepSeek V3.2 Speciale

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Application Gateway | Application Gateway | edge |
| API Management | API Management | edge |
| Azure Functions | Azure Functions | compute |
| Azure Cosmos DB | Azure Cosmos DB | data |
| Storage Account | Storage Account | data |
| Microsoft Entra ID | Microsoft Entra ID | security |
| Key Vault | Key Vault | security |
| Azure Monitor | Azure Monitor | monitoring |
| Application Insights | Application Insights | monitoring |
| Log Analytics | Log Analytics | monitoring |

**Groups:** Edge / Ingress, Compute / Microservices, Data & Storage, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| appgw | apim | Routes HTTPS requests | sync |
| apim | func | Proxies API calls | sync |
| func | cosmos | Reads/writes data | sync |
| func | storage | Uploads/downloads blobs | sync |
| func | keyvault | Retrieves secrets and connection strings | sync |
| apim | entra | Validates JWT tokens | sync |
| func | appinsights | Sends telemetry and logs | async |
| appinsights | monitor | Aggregates metrics | async |
| monitor | loganalytics | Stores and analyzes logs | async |

**Workflow:**

1. Client sends HTTPS request to Application Gateway, which enforces WAF and SSL offloading. _(appgw)_
2. Application Gateway forwards the request to API Management for API gateway capabilities. _(appgw, apim)_
3. API Management validates the JWT token with Microsoft Entra ID and applies policies (rate limiting, transformation). _(apim, entra)_
4. After authentication, API Management routes the request to the appropriate Azure Function microservice. _(apim, func)_
5. Azure Function retrieves secrets (e.g., DB connection strings) from Key Vault. _(func, keyvault)_
6. Azure Function reads/writes data from Cosmos DB and/or uses Blob storage as needed. _(func, cosmos, storage)_
7. Azure Function sends telemetry and logs to Application Insights asynchronously. _(func, appinsights)_
8. Application Insights forwards metrics to Azure Monitor, which aggregates and sends logs to Log Analytics for analysis. _(appinsights, monitor, loganalytics)_

---

### Grok 4.1 Fast

**Services:**

| Service | Type | Group |
|---------|------|-------|
| API Management | API Management | edge |
| Application Gateway | Application Gateway | edge |
| Microsoft Entra ID | Microsoft Entra ID | identity |
| Key Vault | Key Vault | identity |
| Azure Container Apps | Azure Container Apps | microservices |
| Azure Container Apps | Azure Container Apps | microservices |
| Azure Container Apps | Azure Container Apps | microservices |
| Azure Cosmos DB | Azure Cosmos DB | data |
| Azure Cache for Redis | Azure Cache for Redis | data |
| Application Insights | Application Insights | observability |
| Log Analytics | Log Analytics | observability |

**Groups:** Edge & Networking, Identity & Security, Microservices, Data Layer, Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| app-gateway | api-mgmt | Route external traffic through WAF | sync |
| api-mgmt | entra-id | Validate JWT bearer tokens | sync |
| entra-id | api-mgmt | Return token validation result | sync |
| api-mgmt | order-service | Proxy authenticated order requests | sync |
| api-mgmt | payment-service | Proxy authenticated payment requests | sync |
| api-mgmt | user-service | Proxy authenticated user requests | sync |
| order-service | cosmos-db | Store order transactions | sync |
| payment-service | cosmos-db | Record payment events | sync |
| user-service | cosmos-db | Read/write user profiles | sync |
| order-service | redis-cache | Cache order sessions | sync |
| order-service | app-insights | Send request telemetry | async |
| app-insights | log-analytics | Aggregate application metrics | async |
| key-vault | order-service | Fetch database connection strings | sync |

**Workflow:**

1. External client sends authenticated request through WAF _(app-gateway, api-mgmt, entra-id)_
2. API gateway validates JWT and routes to appropriate microservice _(api-mgmt, entra-id, order-service)_
3. Order service fetches secrets and processes business logic _(order-service, key-vault)_
4. Microservices read/write data to Cosmos DB with caching _(order-service, cosmos-db, redis-cache)_
5. Cross-service communication for payment validation _(order-service, payment-service, cosmos-db)_
6. User profile lookups during transaction processing _(payment-service, user-service, cosmos-db)_
7. API gateway aggregates responses and returns to client _(order-service, payment-service, api-mgmt)_
8. Telemetry collection and centralized logging _(order-service, app-insights, log-analytics)_

---

---

## AI Critique

*Reviewer: GPT-5.4 — AI-generated analysis, verify independently.*

## Overall Ranking
1. **GPT-5.1** — Best overall fit because it cleanly covers the core requirements with a coherent Azure-native stack: API gateway, authentication, microservices hosting, secrets, and observability.
2. **GPT-5.2 Codex** — Strong, pragmatic design for a microservices API with auth, but it loses points for omitting Key Vault despite explicitly referencing service identity and operational security.
3. **GPT-5.3 Codex** — Architecturally solid and security-aware, but it introduces useful extras while missing Container Registry, which is a notable deployment gap for AKS-based microservices.
4. **GPT-5.2** — Good inclusion of async messaging and core security components, but it is less precise on the authentication flow and swaps in Cosmos DB without clear justification for the requirement.
5. **GPT-5.4** — Viable hybrid architecture, though it feels overbuilt for the stated need and lacks Container Registry for the AKS-hosted microservices it proposes.
6. **DeepSeek V3.2 Speciale** — Reasonable gateway/auth flow, but Azure Functions is a weaker match for a generic “microservices app” requirement than AKS or Container Apps, and the observability chain is somewhat muddled.
7. **Grok 4.1 Fast** — It includes the key concepts of gateway and auth, but the proposal is structurally inconsistent and under-specified, with duplicated services and missing core operational components.

## Per-Model Analysis

### GPT-5.1
- **Best feature:** It clearly places API Management in front of AKS and explicitly validates JWTs against Microsoft Entra ID, which directly satisfies the API gateway plus auth requirement.
- **Notable gap or concern:** The design omits an edge ingress layer such as Front Door or Application Gateway, which may be acceptable but leaves public entry and WAF concerns unaddressed.

### GPT-5.2
- **Best feature:** Including Service Bus for long-running work is a strong microservices pattern that supports asynchronous processing cleanly.
- **Notable gap or concern:** The authentication flow is too generic and never explicitly shows Microsoft Entra ID issuing and API Management validating tokens, despite auth being a primary requirement.

### GPT-5.2 Codex
- **Best feature:** It provides a straightforward and credible request path of Front Door to API Management to AKS, which is a strong Azure pattern for externally exposed microservices.
- **Notable gap or concern:** Key Vault is missing, leaving secrets and certificate management insufficiently addressed for a production-grade authenticated platform.

### GPT-5.3 Codex
- **Best feature:** It combines API Management, Entra ID, Key Vault, SQL, Redis, and Service Bus into a well-rounded microservices architecture with both sync and async patterns.
- **Notable gap or concern:** It does not include Azure Container Registry, which is a practical omission for AKS image sourcing and deployment workflows.

### GPT-5.4
- **Best feature:** The use of Service Bus with Azure Functions for decoupled background processing is a valid Azure-native pattern for asynchronous workloads.
- **Notable gap or concern:** Azure Container Registry is missing even though AKS is the primary compute platform, creating an incomplete container delivery story.

### DeepSeek V3.2 Speciale
- **Best feature:** The Application Gateway to API Management chain with JWT validation against Microsoft Entra ID is a concrete and correct approach for ingress plus authentication.
- **Notable gap or concern:** Using Azure Functions as the main “microservices” runtime is a weaker fit for the requirement than a container-based platform and may not meet expectations for a typical microservices deployment model.

### Grok 4.1 Fast
- **Best feature:** Choosing Azure Container Apps with API Management, Entra ID, Key Vault, Cosmos DB, and Redis is directionally sound for a modern microservices platform.
- **Notable gap or concern:** The proposal is internally inconsistent, including duplicated Azure Container Apps entries and no clear centralized monitoring service such as Azure Monitor, which reduces architectural confidence.

## Recommendation
I recommend **GPT-5.1** as the best starting point. It most directly satisfies the stated requirements by pairing **API Management** with **Microsoft Entra ID** for authentication and routing requests into **AKS-hosted microservices**, while also covering essential supporting services like **Key Vault**, **Container Registry**, and **Azure Monitor/Log Analytics**. It is the most complete architecture without adding unnecessary complexity for the requirement as stated.

---
*This critique is AI-generated and may reflect the reviewer model's own architectural preferences. Verify findings independently.*
