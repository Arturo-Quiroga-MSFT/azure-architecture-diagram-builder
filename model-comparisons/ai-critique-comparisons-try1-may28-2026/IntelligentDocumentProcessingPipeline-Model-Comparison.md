# Model Comparison Report

**Generated:** 2026-05-28T18:35:32.195Z

**Prompt:** An intelligent document processing pipeline with Azure AI Document Intelligence for OCR, Azure OpenAI for summarization, Cognitive Search for indexing, Cosmos DB for metadata, and Blob Storage for document retention

**Reasoning Effort:** low

**Models Compared:** 6 successful

## Summary

| Model | Time | Tokens | Services | Connections | Groups | Workflow Steps |
|-------|------|--------|----------|-------------|--------|----------------|
| **GPT-5.1** 🔗 Most Detailed | 19.5s | 4,314 | 10 | 12 | 5 | 8 |
| **GPT-5.2** 📦 Most Services 🔗 Most Detailed | 25.7s | 3,958 | 11 | 12 | 5 | 7 |
| **GPT-5.4** 🏆 Most Thorough 📦 Most Services 🔗 Most Detailed | 28.2s | 3,586 | 11 | 12 | 4 | 8 |
| **GPT-5.4 Mini** | 17.4s | 3,837 | 9 | 10 | 3 | 7 |
| **DeepSeek V4 Pro** ⚡ Fastest 💰 Cheapest | 14.5s | 2,816 | 8 | 8 | 4 | 8 |
| **Grok 4.3** | 48.9s | 5,589 | 6 | 7 | 3 | 7 |

## Token Usage

| Model | Prompt Tokens | Completion Tokens | Total |
|-------|--------------|-------------------|-------|
| GPT-5.1 | 1,429 | 2,885 | 4,314 |
| GPT-5.2 | 1,429 | 2,529 | 3,958 |
| GPT-5.4 | 1,429 | 2,157 | 3,586 |
| GPT-5.4 Mini | 1,429 | 2,408 | 3,837 |
| DeepSeek V4 Pro | 1,454 | 1,362 | 2,816 |
| Grok 4.3 | 1,416 | 830 | 5,589 |

## Architecture Details

### GPT-5.1

**Services:**

| Service | Type | Group |
|---------|------|-------|
| App Service | App Service | grp-ingress |
| Document Intelligence | Document Intelligence | grp-ai-processing |
| Azure OpenAI | Azure OpenAI | grp-ai-processing |
| Azure Cognitive Search | Azure Cognitive Search | grp-data |
| Azure Cosmos DB | Azure Cosmos DB | grp-data |
| Storage Account | Storage Account | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity-security |
| Key Vault | Key Vault | grp-identity-security |
| Azure Monitor | Azure Monitor | grp-monitoring |
| Log Analytics | Log Analytics | grp-monitoring |

**Groups:** Client & API Layer, AI Processing Layer, Search & Data Layer, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-app-service | svc-entra | Request user authentication and acquire access tokens for document upload | sync |
| svc-app-service | svc-keyvault | Retrieve service credentials and API keys for Document Intelligence and Azure OpenAI | sync |
| svc-app-service | svc-doc-intel | Submit uploaded document for OCR and layout extraction | sync |
| svc-doc-intel | svc-storage | Persist original files and extracted structured outputs as blobs | sync |
| svc-doc-intel | svc-azure-openai | Send extracted text and key fields for summarization and insight generation | sync |
| svc-azure-openai | svc-app-service | Return summarized content and extracted insights to orchestrator | sync |
| svc-app-service | svc-cosmosdb | Store document metadata, processing status, and AI-generated summaries | sync |
| svc-app-service | svc-cognitive-search | Push document text and metadata for search index update | sync |
| svc-cognitive-search | svc-storage | Retrieve document content or attachments for indexing and search results | sync |
| svc-cognitive-search | svc-cosmosdb | Access enriched metadata as an external data source during indexing and querying | optional |
| svc-app-service | svc-az-monitor | Emit application logs, pipeline metrics, and custom events | async |
| svc-az-monitor | svc-log-analytics | Ingest collected telemetry into centralized log workspace | async |

**Workflow:**

1. User uploads a document through the App Service API, which validates the request via Microsoft Entra ID authentication. _(svc-app-service, svc-entra)_
2. App Service retrieves necessary secrets from Key Vault and submits the document to Document Intelligence for OCR and layout analysis. _(svc-app-service, svc-keyvault, svc-doc-intel)_
3. Document Intelligence processes the file and stores the original document and extracted structured outputs in the Storage Account. _(svc-doc-intel, svc-storage)_
4. Document Intelligence sends extracted text and key fields to Azure OpenAI for summarization and advanced language understanding. _(svc-doc-intel, svc-azure-openai)_
5. Azure OpenAI returns summaries and insights to App Service, which then persists the metadata and AI results in Azure Cosmos DB. _(svc-azure-openai, svc-app-service, svc-cosmosdb)_
6. App Service pushes searchable content and enriched metadata into Azure Cognitive Search to update the index. _(svc-app-service, svc-cognitive-search)_
7. Azure Cognitive Search uses blob content from Storage Account and metadata from Azure Cosmos DB to serve rich search and retrieval experiences. _(svc-cognitive-search, svc-storage, svc-cosmosdb)_
8. During processing and querying, App Service sends telemetry to Azure Monitor, which aggregates the data and stores it in Log Analytics for analysis. _(svc-app-service, svc-az-monitor, svc-log-analytics)_

---

### GPT-5.2

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Storage Account | Storage Account | grp-ingress |
| Azure Event Grid | Azure Event Grid | grp-ingress |
| Azure Functions | Azure Functions | grp-app |
| Document Intelligence | Document Intelligence | grp-app |
| Azure OpenAI | Azure OpenAI | grp-app |
| Azure Cognitive Search | Azure Cognitive Search | grp-app |
| Azure Cosmos DB | Azure Cosmos DB | grp-data |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity-security |
| Key Vault | Key Vault | grp-identity-security |
| Azure Monitor | Azure Monitor | grp-monitoring |
| Log Analytics | Log Analytics | grp-monitoring |

**Groups:** Ingress / Document Intake, Application / AI Processing, Data / Storage, Identity / Security, Monitoring / Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-storage | svc-eventgrid | Publish BlobCreated event when a new document is uploaded | async |
| svc-eventgrid | svc-functions | Trigger document-processing function on new document arrival | async |
| svc-functions | svc-storage | Download original document and persist extracted text/summaries as artifacts | sync |
| svc-functions | svc-docintel | Submit document for OCR/extraction and retrieve structured text/fields | sync |
| svc-functions | svc-openai | Send extracted text for summarization and enrichment generation | sync |
| svc-functions | svc-cosmos | Upsert metadata, processing status, extracted fields, and generated summary | sync |
| svc-functions | svc-search | Push content + metadata to indexing pipeline and request index update | sync |
| svc-search | svc-storage | Fetch blob content (or processed artifacts) as a search data source for indexing | sync |
| svc-functions | svc-keyvault | Read secrets/keys required to call AI services and data stores | sync |
| svc-functions | svc-entra | Validate access tokens for protected processing and administrative operations | sync |
| svc-functions | svc-azmonitor | Emit application logs, custom metrics, and dependency traces | sync |
| svc-azmonitor | svc-loganalytics | Ingest collected logs/metrics for query, alerting, and retention | sync |

**Workflow:**

1. A document is uploaded to Blob Storage for retention and downstream processing. _(svc-storage)_
2. Blob Storage emits a creation event and Event Grid delivers it to the orchestrator. _(svc-storage, svc-eventgrid, svc-functions)_
3. Azure Functions downloads the document and submits it to Document Intelligence for OCR/extraction. _(svc-functions, svc-storage, svc-docintel)_
4. Azure Functions sends extracted text to Azure OpenAI to generate a concise summary and enrichments. _(svc-functions, svc-openai, svc-docintel)_
5. Azure Functions persists metadata, extracted fields, and summaries to Cosmos DB for tracking and retrieval. _(svc-functions, svc-cosmos)_
6. Azure Functions updates Azure Cognitive Search with content/metadata; Search can also read blob artifacts for indexing. _(svc-functions, svc-search, svc-storage)_
7. Operational visibility is captured via Azure Monitor and stored in Log Analytics for querying and alerts. _(svc-functions, svc-azmonitor, svc-loganalytics)_

---

### GPT-5.4

**Services:**

| Service | Type | Group |
|---------|------|-------|
| App Service | App Service | grp-ingress-processing |
| Azure Functions | Azure Functions | grp-ingress-processing |
| Document Intelligence | Document Intelligence | grp-ingress-processing |
| Azure OpenAI | Azure OpenAI | grp-ingress-processing |
| Azure Cognitive Search | Azure Cognitive Search | grp-data-storage |
| Azure Cosmos DB | Azure Cosmos DB | grp-data-storage |
| Storage Account | Storage Account | grp-data-storage |
| Microsoft Entra ID | Microsoft Entra ID | grp-identity-security |
| Key Vault | Key Vault | grp-identity-security |
| Azure Monitor | Azure Monitor | grp-monitoring |
| Log Analytics | Log Analytics | grp-monitoring |

**Groups:** Ingress & Processing, Data & Storage, Identity & Security, Monitoring & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-app-service | svc-entra | Authenticate document users and enforce sign-in policies | sync |
| svc-app-service | svc-functions | Submit uploaded document for processing workflow | sync |
| svc-functions | svc-keyvault | Retrieve AI service secrets and data store connection settings | sync |
| svc-functions | svc-storage | Persist original document and generated artifacts to blob retention | sync |
| svc-functions | svc-doc-intel | Invoke OCR and field extraction on retained document | sync |
| svc-functions | svc-openai | Generate business summary from extracted document text | sync |
| svc-functions | svc-cosmos | Write document metadata, processing status, and summary pointers | sync |
| svc-functions | svc-search | Push searchable content, OCR text, and summary into index | sync |
| svc-app-service | svc-search | Execute document search and retrieve ranked results | sync |
| svc-app-service | svc-cosmos | Read document metadata and processing state for user display | sync |
| svc-functions | svc-monitor | Emit pipeline telemetry, failures, and execution metrics | sync |
| svc-monitor | svc-loganalytics | Store consolidated logs and metrics for troubleshooting queries | sync |

**Workflow:**

1. A user signs in and uploads a document through the web application. _(svc-app-service, svc-entra, svc-functions)_
2. The orchestration layer loads secrets and stores the original file in blob retention. _(svc-functions, svc-keyvault, svc-storage)_
3. The stored document is sent for OCR and structured extraction. _(svc-functions, svc-storage, svc-doc-intel)_
4. Extracted text is summarized into a concise business-friendly synopsis. _(svc-functions, svc-doc-intel, svc-openai)_
5. Document metadata, status, and summary references are persisted for application lookup. _(svc-functions, svc-cosmos, svc-storage)_
6. OCR text and generated summaries are indexed for full-text discovery. _(svc-functions, svc-openai, svc-search)_
7. Users search the corpus and view document details with metadata enrichment. _(svc-app-service, svc-search, svc-cosmos)_
8. Processing telemetry is centralized for operations and troubleshooting. _(svc-functions, svc-monitor, svc-loganalytics)_

---

### GPT-5.4 Mini

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Storage Account | Storage Account | group-ingestion-processing |
| Azure Functions | Azure Functions | group-ingestion-processing |
| Document Intelligence | Document Intelligence | group-ingestion-processing |
| Azure OpenAI | Azure OpenAI | group-ingestion-processing |
| Key Vault | Key Vault | group-security-observability |
| Azure Cognitive Search | Azure Cognitive Search | group-search-metadata |
| Azure Cosmos DB | Azure Cosmos DB | group-search-metadata |
| Azure Monitor | Azure Monitor | group-security-observability |
| Log Analytics | Log Analytics | group-security-observability |

**Groups:** Document Ingestion & Processing, Search Index & Metadata Store, Security & Observability

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| svc-storage | svc-functions | Trigger processing when a new document is uploaded | async |
| svc-functions | svc-keyvault | Retrieve secrets and service credentials for the pipeline | sync |
| svc-functions | svc-docintel | Submit document for OCR and structured extraction | sync |
| svc-docintel | svc-functions | Return extracted text, tables, and layout metadata | sync |
| svc-functions | svc-openai | Send extracted content for concise summarization | sync |
| svc-openai | svc-functions | Return generated summary and key points | sync |
| svc-functions | svc-search | Push enriched document content into the search index | sync |
| svc-functions | svc-cosmos | Persist metadata, document status, and processing results | sync |
| svc-functions | svc-monitor | Emit pipeline metrics, traces, and failure events | async |
| svc-monitor | svc-loganalytics | Stream telemetry into centralized log retention and query workspace | async |

**Workflow:**

1. A user uploads a document into blob storage, which starts the processing pipeline. _(svc-storage, svc-functions)_
2. Azure Functions retrieves secrets from Key Vault and submits the document to Document Intelligence for OCR and structure extraction. _(svc-functions, svc-keyvault, svc-docintel)_
3. Document Intelligence returns extracted text and layout data to Azure Functions for enrichment. _(svc-docintel, svc-functions)_
4. Azure Functions sends the extracted content to Azure OpenAI to generate a concise summary and key points. _(svc-functions, svc-openai)_
5. Azure Functions stores the document summary and extracted fields in Azure Cosmos DB as durable metadata. _(svc-functions, svc-cosmos)_
6. Azure Functions publishes the enriched text and summary to Azure Cognitive Search for indexing and retrieval. _(svc-functions, svc-search)_
7. Azure Functions emits operational telemetry to Azure Monitor, which forwards logs to Log Analytics for investigation. _(svc-functions, svc-monitor, svc-loganalytics)_

---

### DeepSeek V4 Pro

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Storage Account | Storage Account | group-ingest |
| Document Intelligence | Document Intelligence | group-processing |
| Azure OpenAI | Azure OpenAI | group-processing |
| Azure Cognitive Search | Azure Cognitive Search | group-knowledge |
| Azure Cosmos DB | Azure Cosmos DB | group-knowledge |
| App Service | App Service | group-ingest |
| Microsoft Entra ID | Microsoft Entra ID | group-security |
| Key Vault | Key Vault | group-security |

**Groups:** Document Ingestion, AI Processing, Knowledge & Storage, Security & Identity

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| app-service | blob-storage | Upload raw document for long-term retention | sync |
| app-service | document-intelligence | Submit document for OCR and layout analysis | async |
| document-intelligence | azure-openai | Forward extracted text for summarization | async |
| azure-openai | cosmos-db | Persist enrichment metadata and summary | sync |
| app-service | cognitive-search | Push document chunk with metadata to index | async |
| cognitive-search | cosmos-db | Enrich search document with stored metadata | sync |
| app-service | key-vault | Retrieve secrets for downstream AI services | sync |
| app-service | entra-id | Authenticate using managed identity | sync |

**Workflow:**

1. Client uploads a document through the orchestration API, which authenticates via Entra ID and stores the raw file in Blob Storage. _(app-service, entra-id, blob-storage)_
2. Orchestrator retrieves Document Intelligence API key from Key Vault and submits the document for OCR processing. _(app-service, key-vault, document-intelligence)_
3. Document Intelligence returns structured text and layout data back to the orchestrator. _(document-intelligence, app-service)_
4. Orchestrator forwards the extracted text to Azure OpenAI for summarization and key phrase extraction. _(app-service, azure-openai)_
5. Azure OpenAI returns the generated summary and metadata, which the orchestrator persists in Cosmos DB. _(azure-openai, app-service, cosmos-db)_
6. Orchestrator pushes the document chunks with enriched metadata into Cognitive Search for full-text indexing. _(app-service, cognitive-search)_
7. Cognitive Search optionally enriches the indexed document by pulling additional metadata from Cosmos DB. _(cognitive-search, cosmos-db)_
8. End users query Cognitive Search to find and retrieve processed documents with summaries. _(cognitive-search)_

---

### Grok 4.3

**Services:**

| Service | Type | Group |
|---------|------|-------|
| Storage Account | Storage Account | ingress |
| Azure Functions | Azure Functions | processing |
| Document Intelligence | Document Intelligence | processing |
| Azure OpenAI | Azure OpenAI | processing |
| Azure Cognitive Search | Azure Cognitive Search | data |
| Azure Cosmos DB | Azure Cosmos DB | data |

**Groups:** Document Ingress, AI Processing Pipeline, Data and Search Layer

**Connections:**

| From | To | Label | Type |
|------|----|-------|------|
| blob-storage | azure-functions | Notify on new document upload via event trigger | async |
| azure-functions | doc-intelligence | Submit document for OCR text extraction | sync |
| doc-intelligence | azure-functions | Return structured OCR results | sync |
| azure-functions | openai | Request summarization of extracted content | sync |
| openai | azure-functions | Provide AI-generated summary | sync |
| azure-functions | cosmos | Persist document metadata and summary | sync |
| azure-functions | cog-search | Index extracted text and summary for search | sync |

**Workflow:**

1. Document uploaded to Storage Account triggering Azure Functions _(blob-storage, azure-functions)_
2. Azure Functions invokes Document Intelligence to perform OCR _(azure-functions, doc-intelligence)_
3. Document Intelligence returns extracted text and layout data _(doc-intelligence, azure-functions)_
4. Azure Functions sends extracted text to Azure OpenAI for summarization _(azure-functions, openai)_
5. Azure OpenAI returns generated summary to Azure Functions _(openai, azure-functions)_
6. Azure Functions stores metadata and summary in Cosmos DB _(azure-functions, cosmos)_
7. Azure Functions indexes document content and summary in Cognitive Search _(azure-functions, cog-search)_

---

