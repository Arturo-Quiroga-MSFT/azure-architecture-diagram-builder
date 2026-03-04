# Scaling Strategy: 30-40 Concurrent Users

> **Date:** March 4, 2026
> **Context:** Preparing the Azure Architecture Diagram Builder for multi-user access (30-40 simultaneous users)

## Current Architecture

- **Frontend:** React SPA (Vite) served via nginx in Azure Container Apps (ACA)
- **AI Backend:** Azure OpenAI (client-side calls via API key baked into Vite build)
- **Database:** Azure Cosmos DB (diagram history, model comparisons)
- **Telemetry:** Azure Application Insights
- **Region:** East US 2

## Bottleneck Analysis

### 1. Frontend (nginx/SPA) — Low Risk

Static files served by nginx. A single ACA container can handle hundreds of concurrent users. Set min replicas to 2 for resilience.

```bash
az containerapp update --name azure-diagram-builder \
  --min-replicas 2 --max-replicas 5
```

### 2. Azure OpenAI TPM Limits — Critical Bottleneck

A single architecture generation consumes **3,000–8,000+ tokens** (prompt + response). With 30-40 users generating diagrams concurrently, spikes can exceed **200K+ TPM**.

#### Current Model Deployments & TPM Quotas (as of March 4, 2026)

All deployments are **GlobalStandard** on `r2d2-foundry-001.cognitiveservices.azure.com` (AQ-FOUNDRY-RG).

| Model | Deployment Name | TPM | RPM | Retirement | Est. Concurrent Users* |
|---|---|---|---|---|---|
| GPT-5.1 | gpt-5.1 | 932,000 | 9,320 | May 14, 2027 | ~116-155 |
| GPT-5.2 | gpt-5.2 | 809,000 | 8,090 | Dec 11, 2026 | ~101-134 |
| GPT-5.2 Codex | gpt-5.2-codex | 994,000 | 9,940 | Jan 13, 2027 | ~124-165 |
| GPT-5.3 Codex | gpt-5.3-codex | 935,000 | 9,350 | Feb 24, 2027 | ~116-155 |
| DeepSeek V3.2 Speciale | DeepSeek-V3.2-Speciale | 581,000 | 581 | _TBD_ | ~72-96 |
| Grok 4.1 Fast | grok-4-1-fast-non-reasoning | 590,000 | 590 | Dec 30, 2099 | ~73-98 |

> **\*Estimated concurrent users:** Based on 6,000-8,000 tokens per diagram generation request, assuming each user generates ~1 diagram/minute. Formula: TPM ÷ 6,000-8,000 tokens.

#### Capacity Assessment

**Good news:** Your TPM quotas are significantly higher than the minimum needed for 30-40 users.

- **Best case (GPT-5.2 Codex at 994K TPM):** Can handle ~124-165 concurrent diagram generations per minute.
- **Worst case (DeepSeek at 581K TPM):** Can still handle ~72-96 concurrent generations — well above 40.
- **RPM bottleneck note:** DeepSeek (581 RPM) and Grok (590 RPM) have much lower RPM limits compared to the GPT models (8,000-9,900 RPM). If users trigger multiple rapid requests (model comparisons, retries), RPM could be the constraint for these two models, not TPM.
- **Model Comparison feature risk:** The "Compare Models" feature calls up to 6 models simultaneously for one user. With 40 users comparing simultaneously, that's 240 concurrent requests — DeepSeek and Grok RPM limits could be hit.

#### Recommended Actions (updated based on actual quotas)

- **TPM quotas are sufficient** for 30-40 users — no immediate quota increase needed.
- **RPM limits on DeepSeek/Grok** are the real risk. Consider limiting model comparison to GPT models only, or serializing comparison requests to these models.
- **Add 429 retry logic** as a safety net — even with high quotas, burst patterns can temporarily exceed limits.
- **Monitor via Azure AI Studio** during the demo to watch for throttling in real time.

### 3. API Key Security — High Risk at Scale

The API key is currently embedded in the client-side Vite build (`import.meta.env`). Any user can extract it via browser dev tools.

#### Recommended Fix

Add a **lightweight backend proxy** (Node.js/Express or Azure Functions) that:

- Holds the API key server-side
- Forwards requests to Azure OpenAI
- Enables per-user rate limiting
- Provides a single point for request queuing and auth

### 4. Request Queuing and UX

Even with higher TPM, 40 simultaneous diagram generations will create bursts.

- **Client-side queue indicator:** Show users their position if the backend is busy.
- **Stagger model comparison requests:** Serialize rather than parallelize to avoid TPM spikes.
- **Streaming responses (SSE/WebSocket):** Improves perceived latency — users see the diagram building incrementally.

### 5. Cosmos DB — Low Risk

Cosmos DB with serverless or autoscale handles 30-40 users easily. Verify RU/s is not capped too low (400 RU/s should be plenty for this load).

### 6. Application Insights — No Changes Needed

Handles this scale natively. More telemetry data is beneficial for monitoring the above.

## Priority Matrix

| Priority | Action | Effort | Impact |
|---|---|---|---|
| **1** | Increase Azure OpenAI TPM quotas | Low (portal) | Critical |
| **2** | Add 429 retry logic with exponential backoff | Medium (code) | High |
| **3** | Set ACA min replicas to 2 | Low (one CLI command) | Medium |
| **4** | Add backend proxy for API key security | Medium-High (new component) | High (security) |
| **5** | Consider APIM AI Gateway | High (new infra) | High (long-term) |

## Quick Start (Demo with 30-40 People)

For a rapid preparation, focus on priorities **1, 2, and 3**. These require minimal code changes and infrastructure work.

## Production-Grade Rollout

For sustained multi-user access, add priorities **4 and 5** — backend proxy for key security and APIM for intelligent load balancing and caching.
