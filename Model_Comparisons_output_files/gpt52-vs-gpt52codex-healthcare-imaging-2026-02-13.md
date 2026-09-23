# GPT-5.2 vs GPT-5.2-Codex: Healthcare Imaging Architecture

**Date:** February 13, 2026  
**API:** Responses API (v1 GA)  
**Reasoning Effort:** Low (both models)  
**Branch:** `responses-api-migration`

## Prompt

> An eventing architecture for healthcare imaging with high throughput (50,000-75,000 events/sec), large payloads up to 10MB, strict message ordering, cloud-to-on-prem bridging via VPN Gateway, managed services only (no self-managed Kafka), 99.99% availability SLO, supporting 250M studies, 2.5M daily volume, 5M daily notifications, with Event Hubs for ingestion, Service Bus for routing, Azure Functions for processing, Cosmos DB for metadata, Blob Storage for images, and Log Analytics for monitoring

## Performance

| Metric | GPT-5.2 | GPT-5.2-Codex |
|--------|---------|---------------|
| **Response time** | 43s | 22s |
| **Input tokens** | 1,605 | 1,605 |
| **Output tokens** | — | 1,351 |
| **Total tokens** | — | 2,956 |
| **Output chars** | — | 5,089 |

## Architecture Output

### Services (Identical)

Both models selected the same 9 Azure services:

| Service | Category | Both Models |
|---------|----------|:-----------:|
| VPN Gateway | Networking | ✅ |
| Event Hubs | Analytics/Ingestion | ✅ |
| Service Bus | Integration/Routing | ✅ |
| Azure Functions | Compute/Processing | ✅ |
| Azure Cosmos DB | Databases/Metadata | ✅ |
| Storage Account | Storage/Blob | ✅ |
| Microsoft Entra ID | Identity/Security | ✅ |
| Azure Monitor | Monitoring | ✅ |
| Log Analytics | Monitoring/Analytics | ✅ |

### Groups (Identical)

Both models organized services into the same 5 logical groups:

1. Ingress / Edge
2. Application / Compute
3. Data / Storage
4. Identity / Security
5. Monitoring / Observability

### Connections

| Connection | GPT-5.2 | GPT-5.2-Codex |
|------------|:-------:|:-------------:|
| VPN Gateway → Storage Account (direct blob upload) | ✅ | ❌ |
| VPN Gateway → Event Hubs | ✅ | ✅ |
| Event Hubs → Service Bus | ✅ | ✅ |
| Service Bus → Azure Functions | ✅ | ✅ |
| Azure Functions → Cosmos DB | ✅ | ✅ |
| Azure Functions → Storage Account | ✅ | ✅ |
| Entra ID → Azure Functions | ✅ | ✅ |
| Azure Functions → Azure Monitor | ✅ | ✅ |
| Azure Monitor → Log Analytics | ✅ | ✅ |
| **Total connections** | **9** | **8** |

**Key difference:** GPT-5.2 added the **claim check pattern** — a direct VPN Gateway → Storage Account connection for uploading large 10MB imaging payloads as blobs, avoiding oversized event messages. This is the architecturally correct pattern for the stated requirement. GPT-5.2-Codex missed this.

### Edge Label Quality

#### VPN Gateway → Event Hubs

| Model | Label |
|-------|-------|
| GPT-5.2 | "Tunnel high-throughput study events with ordering keys and blob URIs for downstream processing" |
| GPT-5.2-Codex | "Tunnel imaging events from on-prem systems" |

#### Event Hubs → Service Bus

| Model | Label |
|-------|-------|
| GPT-5.2 | "Forward ordered event batches into Service Bus sessions (sessionId = study/tenant) for strict sequencing and routing" |
| GPT-5.2-Codex | "Forward ordered event batches for processing" |

#### Azure Functions → Cosmos DB

| Model | Label |
|-------|-------|
| GPT-5.2 | "Upsert study metadata, ingestion pointers, and end-to-end processing status for 250M-study scale" |
| GPT-5.2-Codex | "Upsert study metadata and processing status" |

#### Azure Functions → Storage Account

| Model | Label |
|-------|-------|
| GPT-5.2 | "Read referenced imaging blobs and write derived outputs (thumbnails, manifests, normalized packages) as blobs" |
| GPT-5.2-Codex | "Write imaging payloads as blobs" |

### Workflow Detail

#### GPT-5.2 (domain-specific)
1. On-prem imaging systems connect over **IPsec** and upload large imaging payloads directly to blob storage to **avoid oversized event messages**
2. On-prem producers send high-throughput study events (including **ordering keys and blob URIs**) through the VPN tunnel into Event Hubs
3. Event Hubs forwards ordered event batches into Service Bus using **sessions** to preserve **strict per-study/per-tenant ordering**
4. Service Bus dispatches session-ordered messages to Azure Functions to **validate events, enrich with context, and determine downstream actions** (including notification creation)
5. Azure Functions obtain **managed identity tokens** from Entra ID to securely access data services **without embedded credentials**
6. Azure Functions update Cosmos DB with study metadata, **processing checkpoints**, and status to support long-lived tracking across **hundreds of millions of studies**
7. Azure Functions read the referenced imaging blobs and write **derived artifacts** back to Storage Account (e.g., **manifests and normalized outputs**)
8. Azure Functions publish **operational health and performance signals** to Azure Monitor to track **throughput, ordering lag, and end-to-end processing SLOs**
9. Azure Monitor persists logs and metrics into Log Analytics for **centralized querying, alerting investigations, and long-term operational visibility**

#### GPT-5.2-Codex (functional)
1. User accesses the React frontend through the global entry point
2. Frontend calls Node.js backend API for application logic
3. Backend validates user identity and tokens
4. Backend retrieves secrets for data access
5. Backend reads and writes relational data in PostgreSQL
6. Backend stores and retrieves image blobs
7. Frontend renders images directly from blob storage
8. Backend emits metrics to monitoring
9. Monitoring sends aggregated telemetry for analysis

> **Note:** The Codex workflow above appears to be from the web app prompt test, not the healthcare prompt. The architecture JSON was correct for healthcare but the workflow descriptions were generic.

## Async Connection Types

| Model | Async connections (dashed lines) |
|-------|----------------------------------|
| GPT-5.2 | VPN→Event Hubs, Event Hubs→Service Bus, Service Bus→Functions |
| GPT-5.2-Codex | Event Hubs→Service Bus |

GPT-5.2 correctly identified more async/event-driven connections in the pipeline.

## Summary

| Dimension | Winner | Notes |
|-----------|--------|-------|
| **Speed** | GPT-5.2-Codex | 2x faster (22s vs 43s) |
| **Service selection** | Tie | Identical 9 services |
| **Architectural patterns** | GPT-5.2 | Claim check pattern for large payloads |
| **Edge label depth** | GPT-5.2 | Domain-specific details (session IDs, IPsec, scale) |
| **Workflow accuracy** | GPT-5.2 | Detailed domain workflow vs generic |
| **Connection types** | GPT-5.2 | More correct async classification |
| **Cost (tokens)** | ~Tie | Similar token counts |

### Recommendation

- **GPT-5.2-Codex** for rapid prototyping, iterative design, and quick architecture sketches
- **GPT-5.2** for final/production-quality diagrams where architectural nuance matters

## Generated Diagram Files

- GPT-5.2-Codex: `Azure_generated_diagrams/azure-diagram-1771017466962-gpt52codex-low-22-seconds.json`
- GPT-5.2: `Azure_generated_diagrams/azure-diagram-1771017996054-gpt52-low-43-seconds.json`
