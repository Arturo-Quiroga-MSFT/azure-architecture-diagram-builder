# Basic Web Application — Model Comparison

## Prompt Used

> A web application with a React frontend, Node.js backend API, PostgreSQL database, and blob storage for images

---

## Summary Table

| Metric | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|---|---|---|---|
| **Generation Time** | 10 seconds | 5 seconds | 97 seconds | 90 seconds |
| **Azure Services** | 4 | 5 | 9 | 9 |
| **Groups** | 3 | 4 | 4 | 4 |
| **Connections** | 3 | 6 | 10 | 10 |
| **Workflow Steps** | 6 | 8 | 8 | 9 |
| **Async Connections** | 0 | 0 | 0 | 2 |
| **Optional Connections** | 0 | 0 | 0 | 0 |
| **Bidirectional Connections** | 0 | 1 | 1 | 1 |
| **Estimated Monthly Cost** | $203 | $203 | $316 | $316 |

---

## Saved Diagram Files

| Model Config | File |
|---|---|
| GPT-4.1 Mini (10s) | `azure-diagram-1770923749064-gpt41mini-10-seconds-basic.json` |
| GPT-4.1 (5s) | `azure-diagram-1770923807879-gpt41-5-seconds-basic.json` |
| GPT-5.2 Low (97s) | `azure-diagram-1770923534801-gpt52-low-97-seconds-basic.json` |
| GPT-5.2 Medium (90s) | `azure-diagram-1770923682059-gpt52-medium-90-seconds-basic.json` |

---

## Services Comparison Matrix

| Azure Service | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| **Azure Static Web Apps** | ✅ | ✅ | ✅ | ✅ |
| **App Service** | ✅ | ✅ | ✅ | ✅ |
| **Azure Database for PostgreSQL** | ✅ | ✅ | ✅ | ✅ |
| **Storage Account** | ✅ | ✅ | ✅ | ✅ |
| **Microsoft Entra ID** | — | ✅ | ✅ | ✅ |
| **Azure Front Door** | — | — | ✅ | ✅ |
| **API Management** | — | — | ✅ | ✅ |
| **Key Vault** | — | — | ✅ | ✅ |
| **Application Insights** | — | — | ✅ | ✅ |

---

## Prompt Requirements Coverage

The prompt explicitly requested only 4 services. The table below shows how each model interpreted implicit production needs:

| Requirement | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|:---:|:---:|:---:|:---:|
| React frontend hosting | ✅ Static Web Apps | ✅ Static Web Apps | ✅ Static Web Apps | ✅ Static Web Apps |
| Node.js backend API | ✅ App Service | ✅ App Service | ✅ App Service | ✅ App Service |
| PostgreSQL database | ✅ | ✅ | ✅ | ✅ |
| Blob storage for images | ✅ Storage Account | ✅ Storage Account | ✅ Storage Account | ✅ Storage Account |
| **Authentication** | ❌ | ✅ Entra ID | ✅ Entra ID | ✅ Entra ID |
| **Edge/CDN protection** | ❌ | ❌ | ✅ Front Door | ✅ Front Door |
| **API gateway** | ❌ | ❌ | ✅ API Management | ✅ API Management |
| **Secrets management** | ❌ | ❌ | ✅ Key Vault | ✅ Key Vault |
| **Observability** | ❌ | ❌ | ✅ App Insights | ✅ App Insights |

---

## Group Organization

| Group | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|---|---|---|---|
| **Frontend / Client & Edge** | "Frontend" (1 svc) | "Web Application Tier" (1 svc) | "Client & Edge" (2 svcs) | "Client + Edge" (2 svcs) |
| **Backend / App & API** | "Backend and API" (1 svc) | "Backend API Tier" (1 svc) | "Application & API" (2 svcs) | "Application + API" (2 svcs) |
| **Data** | "Data Storage" (2 svcs) | "Data Management" (2 svcs) | "Data Layer" (2 svcs) | "Data Layer" (2 svcs) |
| **Security / Observability** | — | "Security & Identity" (1 svc) | "Security & Observability" (3 svcs) | "Security + Observability" (3 svcs) |

---

## Connection Quality Analysis

### GPT-4.1 Mini (3 connections)
Bare minimum data flow with generic labels:
- Static Web Apps → App Service: *"Send API requests for application data"*
- App Service → PostgreSQL: *"Perform SQL queries to read/write user and app data"*
- App Service → Storage: *"Upload and retrieve image blobs"*

### GPT-4.1 (6 connections)
Adds auth flows and direct client-to-storage path:
- Static Web Apps ↔ App Service (bidirectional)
- Static Web Apps → Entra ID: *"Authenticate users through identity provider"*
- App Service → Entra ID: *"Validate bearer tokens for API protection"*
- Static Web Apps → Storage: *"Fetch image blobs for client rendering"* (direct client access)
- App Service → PostgreSQL, App Service → Storage

### GPT-5.2 Low (10 connections)
Full enterprise flow with detailed labels:
- Front Door → Static Web Apps: *"Route and cache SPA asset requests (HTML/JS/CSS) over HTTPS"*
- Front Door → API Management: *"Forward API calls to managed gateway with WAF/edge routing policies"*
- Static Web Apps → Entra ID: *"Redirect user to sign-in and obtain OAuth/OIDC tokens for API access"*
- API Management → Entra ID: *"Validate JWT access tokens and enforce scopes/claims via gateway policies"*
- API Management ↔ App Service (bidirectional): *"Invoke Node.js backend endpoints after applying throttling and request validation"*
- App Service → PostgreSQL: *"Execute parameterized SQL queries and transactions for core application data"*
- App Service → Storage: *"Upload/download image blobs and generate blob URLs or SAS tokens"*
- App Service → Key Vault: *"Retrieve database credentials and storage secrets using managed identity"*
- Static Web Apps → App Insights, App Service → App Insights (telemetry)

### GPT-5.2 Medium (10 connections)
Nearly identical to Low but with 2 connections marked as async (telemetry to App Insights) and slightly different labels:
- App Service → App Insights: *async* — *"Send request traces, dependency metrics, and custom events"*
- Static Web Apps → App Insights: *async* — *"Send frontend page views, JS errors, and performance telemetry"*

---

## Workflow Quality Comparison

### GPT-4.1 Mini — 6 steps (basic)
Linear request/response cycle. No auth, no security, no monitoring.

### GPT-4.1 — 8 steps (adds auth)
Includes authentication flow (steps 2, 4) and direct client image fetching (step 7).

### GPT-5.2 Low — 8 steps (enterprise)
Full lifecycle: edge routing → auth → gateway validation → secrets loading → data access → blob storage → telemetry.

### GPT-5.2 Medium — 9 steps (enterprise, more granular)
Same as Low but splits gateway validation from request forwarding into separate steps (steps 4 and 5).

---

## Cost Comparison (East US 2)

| Service | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low | GPT-5.2 Medium |
|---|---:|---:|---:|---:|
| Azure Static Web Apps | $9.00 | $9.00 | $9.00 | $9.00 |
| App Service (S1) | $69.35 | $69.35 | $69.35 | $69.35 |
| PostgreSQL (Backup LRS) | $109.86 | $109.86 | $109.86 | $109.86 |
| Storage Account (Hot LRS) | $14.60 | $14.60 | $14.60 | $14.60 |
| Microsoft Entra ID | — | $6.00 | $6.00 | $6.00 |
| Azure Front Door (Standard) | — | — | $35.00 | $35.00 |
| API Management (Developer) | — | — | $50.26 | $50.26 |
| Key Vault (Standard) | — | — | $21.90 | $21.90 |
| Application Insights (Basic) | — | — | $0.10 | $0.10 |
| **Total Estimate** | **$202.81** | **$208.81** | **$316.07** | **$316.07** |

---

## Key Takeaways

### 1. Simple Prompts Expose the Biggest Model Differences
With a minimal 1-sentence prompt, the gap between models is stark: GPT-4.1 Mini delivers a literal 4-service sketch while GPT-5.2 delivers a 9-service production blueprint. Complex prompts (like Black Friday) narrow the gap because the user explicitly specifies services.

### 2. GPT-5.2 Low vs Medium — No Difference for Simple Prompts
Both produce identical 9-service architectures with the same groups, same connections, and same cost. The only difference: Medium marks telemetry connections as async (technically more correct) and adds one extra workflow step. The 90-97s generation time isn't justified for simple use cases.

### 3. GPT-4.1 Is the Sweet Spot for Basic Prompts
At 5 seconds, GPT-4.1 adds the one most critical missing piece (authentication via Entra ID) while keeping the architecture simple. It also models a direct client→Storage path for image fetching, showing practical understanding.

### 4. Connection Label Quality Scales with Model
- **GPT-4.1 Mini**: Generic (*"Send API requests for application data"*)
- **GPT-4.1**: Functional (*"Validate bearer tokens for API protection"*)
- **GPT-5.2**: Specific (*"Execute parameterized SQL queries and transactions for core application data"*, *"Retrieve database credentials and storage secrets using managed identity"*)

### 5. Well-Architected Framework Coverage

| WAF Pillar | GPT-4.1 Mini | GPT-4.1 | GPT-5.2 Low/Medium |
|---|:---:|:---:|:---:|
| **Security** | ❌ | ✅ (Entra ID) | ✅ (Entra ID + Key Vault + Front Door WAF) |
| **Reliability** | ❌ | ❌ | ✅ (Front Door CDN/failover) |
| **Performance** | ❌ | ❌ | ✅ (Front Door caching, APIM throttling) |
| **Cost Optimization** | ✅ (minimal) | ✅ (minimal) | ⚠️ (+$113/mo overhead) |
| **Operational Excellence** | ❌ | ❌ | ✅ (Application Insights) |

### 6. Recommendation by Use Case
| Scenario | Best Model | Why |
|---|---|---|
| Quick wireframe / demo | GPT-4.1 (5s) | Fast, adds auth, clean layout |
| Production architecture review | GPT-5.2 Low (97s) | Full WAF coverage, detailed labels |
| Rapid prototyping | GPT-4.1 Mini (10s) | Literal interpretation, fastest sketch |
| GPT-5.2 Medium | Only justified for complex, multi-tier prompts | No benefit over Low for basic prompts |

---

**Generated**: February 12, 2026
**Prompt Complexity**: Basic (1 sentence, 4 explicit services)
**Models Tested**: GPT-4.1 Mini, GPT-4.1, GPT-5.2 Low, GPT-5.2 Medium
